import { Queue } from "bullmq";
import { queueRedis } from "@/lib/redis";
import type { TaskJobData } from "./types";
import { TASK_TYPE, type TaskType, type QueueType } from "./types";

export const QUEUE_NAME = {
  IMAGE: "flintstudio-image",
  VIDEO: "flintstudio-video",
  VOICE: "flintstudio-voice",
  TEXT: "flintstudio-text",
} as const;

const defaultJobOptions = {
  removeOnComplete: 200,
  removeOnFail: 200,
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
};

// BullMQ 自带 ioredis 类型与项目 ioredis 不兼容，运行时兼容，此处做类型断言
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connection = queueRedis as any;
const queueOptions = { connection, defaultJobOptions };

export const imageQueue = new Queue<TaskJobData>(QUEUE_NAME.IMAGE, queueOptions);
export const videoQueue = new Queue<TaskJobData>(QUEUE_NAME.VIDEO, queueOptions);
export const voiceQueue = new Queue<TaskJobData>(QUEUE_NAME.VOICE, queueOptions);
export const textQueue = new Queue<TaskJobData>(QUEUE_NAME.TEXT, queueOptions);

const TEXT_TYPES = new Set<TaskType>([
  TASK_TYPE.ANALYZE_NOVEL,
  TASK_TYPE.STORY_TO_SCRIPT,
  TASK_TYPE.SCRIPT_TO_STORYBOARD,
]);

const IMAGE_TYPES = new Set<TaskType>([
  TASK_TYPE.IMAGE_PANEL,
  TASK_TYPE.IMAGE_CHARACTER,
  TASK_TYPE.IMAGE_LOCATION,
]);

const VIDEO_TYPES = new Set<TaskType>([TASK_TYPE.VIDEO_PANEL]);
const VOICE_TYPES = new Set<TaskType>([TASK_TYPE.VOICE_LINE]);

export function getQueueTypeByTaskType(type: TaskType): QueueType {
  if (TEXT_TYPES.has(type)) return "text";
  if (IMAGE_TYPES.has(type)) return "image";
  if (VIDEO_TYPES.has(type)) return "video";
  if (VOICE_TYPES.has(type)) return "voice";
  return "text";
}

export function getQueueByType(type: QueueType) {
  switch (type) {
    case "image":
      return imageQueue;
    case "video":
      return videoQueue;
    case "voice":
      return voiceQueue;
    default:
      return textQueue;
  }
}

/** 移除 BullMQ 队列中属于指定 runId 的所有待处理/进行中 Job */
export async function cancelRunJobs(runId: string): Promise<void> {
  const queues = [textQueue, imageQueue, voiceQueue, videoQueue];
  for (const q of queues) {
    try {
      const jobs = await q.getJobs(["waiting", "active", "delayed", "prioritized"]);
      for (const job of jobs) {
        if ((job.data as { runId?: string })?.runId === runId) {
          await job.remove().catch(() => {});
        }
      }
    } catch {
      // 忽略单个队列的错误，继续处理其他队列
    }
  }
}
