import { Worker } from "bullmq";
import { queueRedis } from "@/lib/redis";
import { QUEUE_NAME } from "@/lib/task/queues";
import { env, validateEnv } from "@/lib/env";
import { callAdvance } from "@/lib/utils/advance";

// 启动时验证环境变量
try {
  validateEnv();
} catch (e) {
  console.error("[Worker] 环境变量验证失败:", (e as Error).message);
  process.exit(1);
}

// 验证 INTERNAL_TASK_TOKEN
if (!env.INTERNAL_TASK_TOKEN || env.INTERNAL_TASK_TOKEN.includes("please-change")) {
  console.error("[Worker] 错误: INTERNAL_TASK_TOKEN 未设置或为默认值");
  console.error("[Worker] 请设置 INTERNAL_TASK_TOKEN 环境变量用于 Worker 内部通信");
  process.exit(1);
}

// BullMQ 与项目 ioredis 类型不兼容，运行时兼容
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerConnection = queueRedis as any;
import type { TaskJobData } from "@/lib/task/types";
import { prisma } from "@/lib/db";
import { runAnalyzeNovel } from "@/lib/workflow/handlers/analyze-novel";
import { runReviewAnalysis } from "@/lib/workflow/handlers/review-analysis";
import { runStoryToScript } from "@/lib/workflow/handlers/story-to-script";
import { runScriptToStoryboard } from "@/lib/workflow/handlers/script-to-storyboard";
import { advanceRun, failRun, updateStepInputSummary, getRunById } from "@/lib/workflow/service";
import { generateImage } from "@/lib/generators/image-client";
import { generateSpeech } from "@/lib/generators/tts-client";
import { runVoiceExtract } from "@/lib/workflow/handlers/voice-extract";
import { composeEpisodeVideo } from "@/lib/video/compose-episode";
import { getImagePromptSuffix } from "@/lib/workflow/visual-style";
import path from "path";

// ==================== beta0.55 新增：熔断器机制 ====================
class CircuitBreaker {
  private failures = 0;
  private threshold = 5;
  private cooldownMs = 60000; // 1 分钟冷却
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  async execute<T>(operation: () => Promise<T>, context: string): Promise<T> {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime < this.cooldownMs) {
        throw new Error(`Circuit breaker OPEN for ${context}: too many failures, cooling down`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

// API 调用熔断器实例
const apiCircuitBreakers = {
  llm: new CircuitBreaker(),
  image: new CircuitBreaker(),
  voice: new CircuitBreaker(),
  video: new CircuitBreaker(),
};

// ==================== beta0.55 新增：错误分类处理 ====================
enum ErrorSeverity {
  CRITICAL = 'critical',     // 必须解决：如 API 密钥无效
  RETRYABLE = 'retryable',   // 可重试：如网络超时
  DEGRADABLE = 'degradable', // 可降级：如某张图失败用占位图
}

function classifyError(error: Error): { severity: ErrorSeverity; shouldRetry: boolean } {
  const message = error.message.toLowerCase();
  
  // 关键错误 - 不重试
  if (message.includes('api key') || message.includes('unauthorized') || message.includes('forbidden')) {
    return { severity: ErrorSeverity.CRITICAL, shouldRetry: false };
  }
  
  // 可降级错误
  if (message.includes('timeout') || message.includes('network') || message.includes('econnrefused')) {
    return { severity: ErrorSeverity.RETRYABLE, shouldRetry: true };
  }
  
  // 默认可重试
  return { severity: ErrorSeverity.DEGRADABLE, shouldRetry: true };
}

// ==================== beta0.55 新增：带重试的包装函数 ====================
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  maxRetries = TASK_RETRY_OPTIONS.attempts
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const { severity, shouldRetry } = classifyError(lastError);
      
      if (!shouldRetry || attempt === maxRetries) {
        throw lastError;
      }
      
      // 指数退避等待
      const delay = TASK_RETRY_OPTIONS.backoff.delay * Math.pow(2, attempt - 1);
      console.log(`[Worker] ${context} 失败 (尝试 ${attempt}/${maxRetries})，${delay}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

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

// 重试配置
const TASK_RETRY_OPTIONS = {
  attempts: 3,                    // 最多重试 3 次
  backoff: {
    type: 'exponential' as const, // 指数退避
    delay: 2000,                  // 初始延迟 2 秒
  },
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
      // 运行复查 Agent，评估分析结果质量
      const review = await runReviewAnalysis({
        userId,
        episodeCount: episodeIds.length,
        characterCount: np?.characters?.length ?? 0,
        locationCount: np?.locations?.length ?? 0,
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
      let done = 0;
      let failed = 0;
      const failedPanels: string[] = [];

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
      }
      
      // 如果有失败的图片，记录警告
      if (failed > 0) {
        console.warn(`[Worker:image] 集 ${episodeId} 中 ${failed}/${panels.length} 个面板生成失败`);
      }
      
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
      
      const segs = episode.voiceLines.map((vl: { id: string }, i: number) => {
        const audioPath = path.join(VOICE_DIR, `${vl.id}.mp3`);
        const panel = panelsOrdered[i % Math.max(1, panelsOrdered.length)];
        return {
          imageUrl: panel?.imageUrl ?? null,
          audioPath,
        };
      });
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

const workers = [textWorker, imageWorker, voiceWorker, videoWorker];

workers.forEach((w) => {
  w.on("ready", () => console.log(`[Workers] ${w.name} ready`));
  w.on("error", (err: Error) => console.error(`[Workers] ${w.name} error:`, err.message));
});

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
