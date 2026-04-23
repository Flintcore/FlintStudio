import { Worker } from "bullmq";
import { queueRedis } from "@/lib/redis";
import { QUEUE_NAME } from "@/lib/task/queues";
import { env, validateEnv } from "@/lib/env";
import { resolveInternalTaskToken } from "@/lib/internal-task-token";
import { callAdvance } from "@/lib/utils/advance";

// BullMQ 与项目 ioredis 类型不兼容，运行时兼容
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerConnection = queueRedis as any;
import type { TaskJobData } from "@/lib/task/types";
import { prisma } from "@/lib/db";
import { runAnalyzeNovel } from "@/lib/workflow/handlers/analyze-novel";
import { runReviewAnalysis } from "@/lib/workflow/handlers/review-analysis";
import { runStoryToScript } from "@/lib/workflow/handlers/story-to-script";
import { runScriptToStoryboard } from "@/lib/workflow/handlers/script-to-storyboard";
import { failRun, updateStepInputSummary, getRunById } from "@/lib/workflow/service";
import { generateImage } from "@/lib/generators/image-client";
import { generateSpeech } from "@/lib/generators/tts-client";
import { runVoiceExtract } from "@/lib/workflow/handlers/voice-extract";
import { composeEpisodeVideo } from "@/lib/video/compose-episode";
import { getImagePromptSuffix } from "@/lib/workflow/visual-style";
import path from "path";
import { existsSync } from "fs";

// 全局变量声明（用于内存监控）


const concurrency = {
  image: env.QUEUE_CONCURRENCY_IMAGE,
  video: env.QUEUE_CONCURRENCY_VIDEO,
  voice: env.QUEUE_CONCURRENCY_VOICE,
  text: env.QUEUE_CONCURRENCY_TEXT,
};

// 任务超时配置（毫秒）- 优化版 beta0.55
const TASK_TIMEOUTS = {
  text: 15 * 60 * 1000,    // 15 分钟（大文本分析需要更久）
  image: 10 * 60 * 1000,   // 10 分钟（复杂图生成）
  voice: 15 * 60 * 1000,   // 15 分钟（长对白）
  video: 60 * 60 * 1000,   // 60 分钟（长视频合成）
};


async function processTextJob(job: { data: TaskJobData }) {
  const { type, taskId, userId, projectId, targetId, payload, runId } = job.data;

  if (type === "analyze-novel") {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, result: true },
    });
    if (task?.status === "completed" && task.result != null) {
      if (runId) await callAdvance(runId, taskId);
      return;
    }
    const novelText = String((payload as { novelText?: string })?.novelText ?? "").trim();
    if (!novelText) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", errorMessage: "缺少 novelText" },
      });
      if (runId) await failRun(runId, "缺少 novelText");
      return;
    }

    // 验证输入长度
    if (novelText.length > 100000) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", errorMessage: "小说文本超过最大长度限制 (100000 字符)" },
      });
      if (runId) await failRun(runId, "小说文本过长");
      return;
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
    if (runId) await updateStepInputSummary(runId, taskId, { novelTextLength: novelText.length });

    try {
      const { episodeIds } = await runAnalyzeNovel({
        userId,
        projectId,
        novelPromotionId: targetId,
        novelText,
      });
      const np = await prisma.novelPromotionProject.findUnique({
        where: { id: targetId },
        include: { characters: true, locations: true },
      });
      // 查询剧集摘要（取前5集，每集最多200字，供复查 Agent 实质性评估）
      const episodesForReview = await prisma.novelPromotionEpisode.findMany({
        where: { id: { in: episodeIds } },
        select: { name: true, novelText: true },
        take: 5,
      });
      const episodeSummaries = episodesForReview.map(
        (e) => `${e.name}：${(e.novelText ?? "").slice(0, 200)}`
      );
      // 运行复查 Agent，评估分析结果质量（传入实质内容）
      const review = await runReviewAnalysis({
        userId,
        episodeCount: episodeIds.length,
        characterCount: np?.characters?.length ?? 0,
        locationCount: np?.locations?.length ?? 0,
        characters: (np?.characters ?? []).map((c: { name: string }) => c.name).slice(0, 10),
        locations: (np?.locations ?? []).map((l: { name: string }) => l.name).slice(0, 10),
        episodeSummaries,
      });
      
      // 记录复查结果
      console.log(`[Worker] 剧本分析复查结果: 评分 ${review.score}/100, 通过: ${review.passed}`);
      if (!review.passed && review.issues.length > 0) {
        console.warn(`[Worker] 复查发现问题: ${review.issues.join("; ")}`);
      }
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "completed",
          finishedAt: new Date(),
          result: { episodeIds, review: review as Record<string, unknown> } as object,
        },
      });
      if (runId) await callAdvance(runId, taskId);
    } catch (e) {
      const msg = (e as Error).message ?? "剧本分析失败";
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", errorMessage: msg, finishedAt: new Date() },
      });
      if (runId) await failRun(runId, msg);
      throw e;
    }
    return;
  }

  if (type === "story-to-script") {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, result: true },
    });
    if (task?.status === "completed" && task.result != null) {
      if (runId) await callAdvance(runId, taskId);
      return;
    }
    const episodeId = String((payload as { episodeId?: string })?.episodeId ?? targetId).trim();
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
    if (runId) await updateStepInputSummary(runId, taskId, { episodeId });
    try {
      const episode = await prisma.novelPromotionEpisode.findUnique({
        where: { id: episodeId },
        select: { id: true, novelText: true, novelPromotionProjectId: true },
      });
      if (!episode?.novelText?.trim()) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "completed", finishedAt: new Date(), result: { clipIds: [] } },
        });
        if (runId) await callAdvance(runId, taskId);
        return;
      }
      const np = await prisma.novelPromotionProject.findUnique({
        where: { id: episode.novelPromotionProjectId },
        include: { characters: true, locations: true },
      });
      const characterNames = (np?.characters ?? []).map((c: { name: string }) => c.name);
      const locationNames = (np?.locations ?? []).map((l: { name: string }) => l.name);
      const { clipIds } = await runStoryToScript({
        userId,
        episodeId,
        episodeContent: episode.novelText,
        characterNames,
        locationNames,
      });
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "completed",
          finishedAt: new Date(),
          result: { clipIds },
        },
      });
      if (runId) await callAdvance(runId, taskId);
    } catch (e) {
      const msg = (e as Error).message ?? "分场失败";
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", errorMessage: msg, finishedAt: new Date() },
      });
      if (runId) await failRun(runId, msg);
      throw e;
    }
    return;
  }

  if (type === "script-to-storyboard") {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, result: true },
    });
    if (task?.status === "completed" && task.result != null) {
      if (runId) await callAdvance(runId, taskId);
      return;
    }
    const episodeId = String((payload as { episodeId?: string })?.episodeId ?? targetId).trim();
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
    if (runId) await updateStepInputSummary(runId, taskId, { episodeId });
    try {
      const episode = await prisma.novelPromotionEpisode.findUnique({
        where: { id: episodeId },
        include: { clips: true },
      });
      if (!episode || episode.clips.length === 0) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "completed", finishedAt: new Date(), result: {} },
        });
        if (runId) await callAdvance(runId, taskId);
        return;
      }
      const run = runId ? await getRunById(runId) : null;
      const visualStyleId = (run?.input as { visualStyle?: string } | null)?.visualStyle || null;
      const allPanelIds: string[] = [];
      for (const clip of episode.clips) {
        const { panelIds } = await runScriptToStoryboard({
          userId,
          clipId: clip.id,
          clipContent: clip.content,
          visualStyleId,
        });
        allPanelIds.push(...panelIds);
      }
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "completed",
          finishedAt: new Date(),
          result: { panelIds: allPanelIds },
        },
      });
      if (runId) await callAdvance(runId, taskId);
    } catch (e) {
      const msg = (e as Error).message ?? "分镜失败";
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", errorMessage: msg, finishedAt: new Date() },
      });
      if (runId) await failRun(runId, msg);
      throw e;
    }
  }
}

async function processImageJob(job: { data: TaskJobData }) {
  const { type, taskId, userId, targetId, payload, runId } = job.data;

  if (type === "image-panel") {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, result: true },
    });
    if (task?.status === "completed" && task.result != null) {
      if (runId) await callAdvance(runId, taskId);
      return;
    }
    const episodeId = String((payload as { episodeId?: string })?.episodeId ?? targetId).trim();
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
    if (runId) await updateStepInputSummary(runId, taskId, { episodeId });
    try {
      const run = runId ? await getRunById(runId) : null;
      const visualStyleId = (run?.input as { visualStyle?: string } | null)?.visualStyle || null;
      const styleSuffix = getImagePromptSuffix(visualStyleId);

      const panels = await prisma.novelPromotionPanel.findMany({
        where: {
          storyboard: { episodeId },
        },
        orderBy: [{ storyboardId: "asc" }, { panelIndex: "asc" }],
      });

      // 如果没有面板，任务直接完成
      if (panels.length === 0) {
        console.warn(`[Worker:image] 剧集 ${episodeId} 没有面板需要处理`);
        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: "completed",
            finishedAt: new Date(),
            result: { panelsProcessed: 0, panelsFailed: 0, failedPanelIds: [] },
          },
        });
        if (runId) await callAdvance(runId, taskId);
        return;
      }

      let done = 0;
      let failed = 0;
      const failedPanels: string[] = [];
      const total = panels.length;

      console.log(`[Worker:image] 开始处理 ${total} 个面板，剧集 ${episodeId}`);

      for (const panel of panels) {
        const basePrompt = panel.imagePrompt?.trim() || panel.description?.trim() || "cinematic scene";
        const prompt = styleSuffix
          ? `${basePrompt}${styleSuffix}`
          : basePrompt;
        try {
          // 添加单个面板的超时控制
          const timeoutMs = 60000; // 60 秒超时
          const result = await Promise.race([
            generateImage({
              userId,
              prompt: prompt.slice(0, 4000),
              size: "1024x1024",
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("图像生成超时")), timeoutMs)
            ),
          ]);
          if (result.url) {
            await prisma.novelPromotionPanel.update({
              where: { id: panel.id },
              data: { imageUrl: result.url },
            });
            done++;
          }
        } catch (e) {
          failed++;
          failedPanels.push(panel.id);
          console.error("[Worker:image] panel", panel.id, (e as Error).message);
        }
        // 每 5 个面板或完成时更新进度（减少数据库写入）
        if ((done + failed) % 5 === 0 || done + failed === total) {
          const progress = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
          await prisma.task.update({
            where: { id: taskId },
            data: { progress, payload: { episodeId, done, total } as object },
          }).catch(() => {});
        }
      }
      
      // 如果有失败的图片，记录警告
      if (failed > 0) {
        console.warn(`[Worker:image] 集 ${episodeId} 中 ${failed}/${panels.length} 个面板生成失败`);
      }

      console.log(`[Worker:image] 完成处理 ${total} 个面板，成功 ${done}，失败 ${failed}`);
      
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: failed === panels.length && panels.length > 0 ? "failed" : "completed",
          finishedAt: new Date(),
          result: { panelsProcessed: done, panelsFailed: failed, failedPanelIds: failedPanels },
          ...(failed > 0 ? { errorMessage: `${failed} 个面板生成失败` } : {}),
        },
      });
      if (runId) await callAdvance(runId, taskId);
    } catch (e) {
      const msg = (e as Error).message ?? "分镜出图失败";
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", errorMessage: msg, finishedAt: new Date() },
      });
      if (runId) await failRun(runId, msg);
      throw e;
    }
    return;
  }

  console.log("[Worker:image]", type, taskId);
}

const DATA_DIR = env.DATA_DIR || path.join(process.cwd(), "data");
const VOICE_DIR = path.join(DATA_DIR, "voice");
const _EPISODES_DIR = path.join(DATA_DIR, "episodes");


async function processVoiceJob(job: { data: TaskJobData }) {
  const { type, taskId, userId, projectId, targetId, payload, runId } = job.data;

  if (type === "voice-line") {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, result: true },
    });
    if (task?.status === "completed" && task.result != null) {
      if (runId) await callAdvance(runId, taskId);
      return;
    }
    const episodeId = String((payload as { episodeId?: string })?.episodeId ?? targetId).trim();
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
    if (runId) await updateStepInputSummary(runId, taskId, { episodeId });
    try {
      const episode = await prisma.novelPromotionEpisode.findUnique({
        where: { id: episodeId },
        include: { clips: true },
      });
      if (!episode || episode.clips.length === 0) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "completed", finishedAt: new Date(), result: {} },
        });
        if (runId) await callAdvance(runId, taskId);
        return;
      }
      const clipsContent = episode.clips.map((c: { content: string }) => c.content);
      const { lineIds } = await runVoiceExtract({
        userId,
        episodeId,
        clipsContent,
      });
      
      // 如果没有提取到任何台词，任务失败
      if (lineIds.length === 0) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "failed", errorMessage: "未能从剧集中提取到任何台词", finishedAt: new Date() },
        });
        if (runId) await failRun(runId, "未能从剧集中提取到任何台词");
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const lineId of lineIds) {
        const line = await prisma.novelPromotionVoiceLine.findUnique({
          where: { id: lineId },
        });
        if (!line?.content) continue;
        try {
          // 单个配音超时 30 秒
          const timeoutMs = 30000;
          const result = await Promise.race([
            generateSpeech({
              userId,
              text: line.content,
              voiceLineId: line.id,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("TTS 超时")), timeoutMs)
            ),
          ]);
          await prisma.novelPromotionVoiceLine.update({
            where: { id: line.id },
            data: { audioUrl: result.audioUrl },
          });
          successCount++;
        } catch (e) {
          failCount++;
          console.error("[Worker:voice] TTS failed for line", line.id, (e as Error).message);
        }
      }
      
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "completed",
          finishedAt: new Date(),
          result: { lineIds, successCount, failCount },
        },
      });
      if (runId) await callAdvance(runId, taskId);
    } catch (e) {
      const msg = (e as Error).message ?? "配音失败";
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", errorMessage: msg, finishedAt: new Date() },
      });
      if (runId) await failRun(runId, msg);
      throw e;
    }
    return;
  }

  console.log("[Worker:voice]", type, taskId);
}

async function processVideoJob(job: { data: TaskJobData }) {
  const { type, taskId, targetId, payload, runId } = job.data;

  if (type === "video-panel") {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, result: true },
    });
    if (task?.status === "completed" && task.result != null) {
      if (runId) await callAdvance(runId, taskId);
      return;
    }
    const episodeId = String((payload as { episodeId?: string })?.episodeId ?? targetId).trim();
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
    if (runId) await updateStepInputSummary(runId, taskId, { episodeId });
    try {
      const episode = await prisma.novelPromotionEpisode.findUnique({
        where: { id: episodeId },
        include: {
          voiceLines: { orderBy: { lineIndex: "asc" } },
          clips: {
            include: {
              storyboard: { include: { panels: { orderBy: { panelIndex: "asc" } } } },
            },
          },
        },
      });
      if (!episode || episode.voiceLines.length === 0) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "completed", finishedAt: new Date(), result: {} },
        });
        if (runId) await callAdvance(runId, taskId);
        return;
      }
      const panelsOrdered: Array<{ imageUrl: string | null }> = [];
      for (const clip of episode.clips) {
        const sb = clip.storyboard;
        if (sb?.panels) {
          for (const p of sb.panels) {
            panelsOrdered.push({ imageUrl: p.imageUrl });
          }
        }
      }
      
      // 检查面板和配音数量不匹配问题
      if (panelsOrdered.length < episode.voiceLines.length) {
        console.warn(
          `[Worker:video] 面板数量 (${panelsOrdered.length}) 少于配音行数 (${episode.voiceLines.length})，` +
          `部分图片将被重复使用`
        );
      }
      
      // 构建视频片段，过滤掉缺少音频文件的条目
      const segs: Array<{ imageUrl: string | null; audioPath: string }> = [];
      let skippedAudioCount = 0;
      for (let i = 0; i < episode.voiceLines.length; i++) {
        const vl = episode.voiceLines[i];
        const audioPath = path.join(VOICE_DIR, `${vl.id}.mp3`);
        if (!existsSync(audioPath)) {
          console.warn(`[Worker:video] 配音文件不存在，跳过: ${audioPath}`);
          skippedAudioCount++;
          continue;
        }
        const panel = panelsOrdered[i % Math.max(1, panelsOrdered.length)];
        segs.push({
          imageUrl: panel?.imageUrl ?? null,
          audioPath,
        });
      }

      if (segs.length === 0) {
        throw new Error(`没有可用的配音文件（跳过了 ${skippedAudioCount} 个缺失文件）`);
      }

      if (skippedAudioCount > 0) {
        console.warn(`[Worker:video] 共跳过 ${skippedAudioCount} 个缺失的配音文件`);
      }
      const { videoPath } = await composeEpisodeVideo({
        episodeId,
        segments: segs,
      });
      const videoUrl = `${env.NEXTAUTH_URL}/api/media/episode/${episodeId}/video`;
      await prisma.novelPromotionEpisode.update({
        where: { id: episodeId },
        data: { videoUrl },
      });
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "completed",
          finishedAt: new Date(),
          result: { videoPath, videoUrl },
        },
      });
      if (runId) await callAdvance(runId, taskId);
    } catch (e) {
      const msg = (e as Error).message ?? "视频合成失败";
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", errorMessage: msg, finishedAt: new Date() },
      });
      if (runId) await failRun(runId, msg);
      throw e;
    }
    return;
  }

  console.log("[Worker:video]", type, taskId);
}

// 包装处理器添加超时控制
function withTimeout<T>(
  processor: (job: { data: TaskJobData }) => Promise<T>,
  timeoutMs: number,
  jobType: string
) {
  return async (job: { data: TaskJobData; id?: string }): Promise<T> => {
    const startTime = Date.now();
    return Promise.race([
      processor(job),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          const duration = Date.now() - startTime;
          reject(new Error(`${jobType} 任务超时 (${duration}ms > ${timeoutMs}ms)`));
        }, timeoutMs)
      ),
    ]);
  };
}

let workers: Worker<TaskJobData>[] = [];

function registerWorkers(): void {
  const textWorker = new Worker<TaskJobData>(
    QUEUE_NAME.TEXT,
    withTimeout(processTextJob, TASK_TIMEOUTS.text, "Text"),
    { connection: workerConnection, concurrency: concurrency.text }
  );

  const imageWorker = new Worker<TaskJobData>(
    QUEUE_NAME.IMAGE,
    withTimeout(processImageJob, TASK_TIMEOUTS.image, "Image"),
    { connection: workerConnection, concurrency: concurrency.image }
  );

  const voiceWorker = new Worker<TaskJobData>(
    QUEUE_NAME.VOICE,
    withTimeout(processVoiceJob, TASK_TIMEOUTS.voice, "Voice"),
    { connection: workerConnection, concurrency: concurrency.voice }
  );

  const videoWorker = new Worker<TaskJobData>(
    QUEUE_NAME.VIDEO,
    withTimeout(processVideoJob, TASK_TIMEOUTS.video, "Video"),
    { connection: workerConnection, concurrency: concurrency.video }
  );

  workers = [textWorker, imageWorker, voiceWorker, videoWorker];

  workers.forEach((w) => {
    w.on("ready", () => console.log(`[Workers] ${w.name} ready`));
    w.on("error", (err: Error) => console.error(`[Workers] ${w.name} error:`, err.message));
  });
}

void (async function workerBootstrap() {
  try {
    validateEnv();
    await resolveInternalTaskToken();
    registerWorkers();
    console.log("[Workers] 已启动（内部令牌：环境变量或设置页数据库）");
  } catch (e) {
    console.error("[Worker] 启动失败:", (e as Error).message);
    process.exit(1);
  }
})();

async function shutdown() {
  console.log("[Workers] 正在关闭...");
  await Promise.all(workers.map((w) => w.close()));
  console.log("[Workers] 已关闭");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

// 未捕获的异常处理
process.on("uncaughtException", (err) => {
  console.error("[Workers] 未捕获的异常:", err);
  void shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Workers] 未处理的 Promise 拒绝:", promise, "原因:", reason);
  void shutdown();
});

// 内存监控 - 防止内存泄漏
const MEMORY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟
const MEMORY_THRESHOLD_MB = 1024; // 1GB

setInterval(() => {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);

  if (heapUsedMB > MEMORY_THRESHOLD_MB) {
    console.warn(`[Workers] 内存使用较高: RSS=${rssMB}MB, Heap=${heapUsedMB}MB`);
    // 建议垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
      console.log("[Workers] 已触发垃圾回收");
    }
  }
}, MEMORY_CHECK_INTERVAL);
