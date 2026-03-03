import { Worker } from "bullmq";
import { queueRedis } from "@/lib/redis";
import { QUEUE_NAME } from "@/lib/task/queues";
import type { TaskJobData } from "@/lib/task/types";
import { prisma } from "@/lib/db";
import { runAnalyzeNovel } from "@/lib/workflow/handlers/analyze-novel";
import { runStoryToScript } from "@/lib/workflow/handlers/story-to-script";
import { runScriptToStoryboard } from "@/lib/workflow/handlers/script-to-storyboard";
import { advanceRun, failRun } from "@/lib/workflow/service";
import { generateImage } from "@/lib/generators/image-client";
import { generateSpeech } from "@/lib/generators/tts-client";
import { runVoiceExtract } from "@/lib/workflow/handlers/voice-extract";
import { composeEpisodeVideo } from "@/lib/video/compose-episode";
import path from "path";

const concurrency = {
  image: Number(process.env.QUEUE_CONCURRENCY_IMAGE) || 4,
  video: Number(process.env.QUEUE_CONCURRENCY_VIDEO) || 2,
  voice: Number(process.env.QUEUE_CONCURRENCY_VOICE) || 4,
  text: Number(process.env.QUEUE_CONCURRENCY_TEXT) || 4,
};

const INTERNAL_TASK_TOKEN = process.env.INTERNAL_TASK_TOKEN || "";
const NEXT_PUBLIC_APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

async function callAdvance(runId: string, taskId: string) {
  if (!INTERNAL_TASK_TOKEN) return;
  try {
    await fetch(`${NEXT_PUBLIC_APP_URL}/api/workflows/advance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INTERNAL_TASK_TOKEN}`,
      },
      body: JSON.stringify({ runId, taskId }),
    });
  } catch (e) {
    console.error("[Workers] advance call failed:", (e as Error).message);
  }
}

async function processTextJob(job: { data: TaskJobData }) {
  const { type, taskId, userId, projectId, targetId, payload, runId } = job.data;

  if (type === "analyze-novel") {
    const novelText = String((payload as { novelText?: string })?.novelText ?? "").trim();
    if (!novelText) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", errorMessage: "缺少 novelText" },
      });
      if (runId) await failRun(runId, "缺少 novelText");
      return;
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });

    try {
      const { episodeIds } = await runAnalyzeNovel({
        userId,
        projectId,
        novelPromotionId: targetId,
        novelText,
      });
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "completed",
          finishedAt: new Date(),
          result: { episodeIds },
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
    const episodeId = String((payload as { episodeId?: string })?.episodeId ?? targetId).trim();
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
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
    const episodeId = String((payload as { episodeId?: string })?.episodeId ?? targetId).trim();
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
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
      const allPanelIds: string[] = [];
      for (const clip of episode.clips) {
        const { panelIds } = await runScriptToStoryboard({
          userId,
          clipId: clip.id,
          clipContent: clip.content,
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
    const episodeId = String((payload as { episodeId?: string })?.episodeId ?? targetId).trim();
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
    try {
      const panels = await prisma.novelPromotionPanel.findMany({
        where: {
          storyboard: { episodeId },
        },
        orderBy: [{ storyboardId: "asc" }, { panelIndex: "asc" }],
      });
      let done = 0;
      for (const panel of panels) {
        const prompt = panel.imagePrompt?.trim() || panel.description?.trim() || "cinematic scene";
        try {
          const { url } = await generateImage({
            userId,
            prompt: prompt.slice(0, 4000),
            size: "1024x1024",
          });
          if (url) {
            await prisma.novelPromotionPanel.update({
              where: { id: panel.id },
              data: { imageUrl: url },
            });
          }
        } catch (e) {
          console.error("[Worker:image] panel", panel.id, (e as Error).message);
        }
        done++;
      }
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "completed",
          finishedAt: new Date(),
          result: { panelsProcessed: done },
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

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const VOICE_DIR = path.join(DATA_DIR, "voice");

async function processVoiceJob(job: { data: TaskJobData }) {
  const { type, taskId, userId, projectId, targetId, payload, runId } = job.data;

  if (type === "voice-line") {
    const episodeId = String((payload as { episodeId?: string })?.episodeId ?? targetId).trim();
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
    try {
      const episode = await prisma.novelPromotionEpisode.findUnique({
        where: { id: episodeId },
        include: { clips: { orderBy: { createdAt: "asc" } } },
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
      for (const lineId of lineIds) {
        const line = await prisma.novelPromotionVoiceLine.findUnique({
          where: { id: lineId },
        });
        if (!line?.content) continue;
        try {
          const { audioUrl } = await generateSpeech({
            userId,
            text: line.content,
            voiceLineId: line.id,
          });
          await prisma.novelPromotionVoiceLine.update({
            where: { id: line.id },
            data: { audioUrl },
          });
        } catch (e) {
          console.error("[Worker:voice] TTS failed for line", line.id, (e as Error).message);
        }
      }
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "completed",
          finishedAt: new Date(),
          result: { lineIds },
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
    const episodeId = String((payload as { episodeId?: string })?.episodeId ?? targetId).trim();
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });
    try {
      const episode = await prisma.novelPromotionEpisode.findUnique({
        where: { id: episodeId },
        include: {
          voiceLines: { orderBy: { lineIndex: "asc" } },
          clips: {
            orderBy: { createdAt: "asc" },
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
      const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const videoUrl = `${base}/api/media/episode/${episodeId}/video`;
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

const textWorker = new Worker<TaskJobData>(
  QUEUE_NAME.TEXT,
  processTextJob,
  { connection: queueRedis, concurrency: concurrency.text }
);

const imageWorker = new Worker<TaskJobData>(
  QUEUE_NAME.IMAGE,
  processImageJob,
  { connection: queueRedis, concurrency: concurrency.image }
);

const voiceWorker = new Worker<TaskJobData>(
  QUEUE_NAME.VOICE,
  processVoiceJob,
  { connection: queueRedis, concurrency: concurrency.voice }
);

const videoWorker = new Worker<TaskJobData>(
  QUEUE_NAME.VIDEO,
  processVideoJob,
  { connection: queueRedis, concurrency: concurrency.video }
);

const workers = [textWorker, imageWorker, voiceWorker, videoWorker];

workers.forEach((w) => {
  w.on("ready", () => console.log(`[Workers] ${w.name} ready`));
  w.on("error", (err: Error) => console.error(`[Workers] ${w.name} error:`, err.message));
});

async function shutdown() {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
