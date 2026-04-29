/**
 * 队列状态监控 API
 * GET /api/admin/queues - 获取队列状态和统计
 */

import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { queueRedis } from "@/lib/redis";
import { getWorkerStats, getActiveTasks } from "@/lib/workers/metrics";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connection = queueRedis as any;

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

async function getQueueStatus(name: string): Promise<QueueStatus> {
  const queue = new Queue(name, { connection });

  const [
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  ] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.isPaused(),
  ]);

  await queue.close();

  return {
    name,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  };
}

export async function GET() {
  try {
    const [
      textQueue,
      imageQueue,
      voiceQueue,
      videoQueue,
      workerStats,
      activeTasks,
    ] = await Promise.all([
      getQueueStatus("flintstudio-text"),
      getQueueStatus("flintstudio-image"),
      getQueueStatus("flintstudio-voice"),
      getQueueStatus("flintstudio-video"),
      getWorkerStats(),
      Promise.resolve(getActiveTasks()),
    ]);

    const totalWaiting = textQueue.waiting + imageQueue.waiting + voiceQueue.waiting + videoQueue.waiting;
    const totalActive = textQueue.active + imageQueue.active + voiceQueue.active + videoQueue.active;
    const totalFailed = textQueue.failed + imageQueue.failed + voiceQueue.failed + videoQueue.failed;

    return NextResponse.json({
      queues: {
        text: textQueue,
        image: imageQueue,
        voice: voiceQueue,
        video: videoQueue,
      },
      summary: {
        totalWaiting,
        totalActive,
        totalFailed,
        totalCompleted: textQueue.completed + imageQueue.completed + voiceQueue.completed + videoQueue.completed,
      },
      workers: workerStats,
      activeTasks: activeTasks.slice(0, 10), // 只返回前10个活跃任务
    });
  } catch (error) {
    console.error("[admin/queues]", error);
    return NextResponse.json(
      { error: "获取队列状态失败" },
      { status: 500 }
    );
  }
}

// POST - 控制队列（暂停/恢复）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, queue: queueName } = body;

    if (!action || !queueName) {
      return NextResponse.json(
        { error: "缺少 action 或 queue 参数" },
        { status: 400 }
      );
    }

    const queue = new Queue(`flintstudio-${queueName}`, { connection });

    if (action === "pause") {
      await queue.pause();
    } else if (action === "resume") {
      await queue.resume();
    } else if (action === "clean") {
      await queue.clean(0, 0, "completed");
      await queue.clean(0, 0, "failed");
    } else {
      await queue.close();
      return NextResponse.json(
        { error: "未知的 action" },
        { status: 400 }
      );
    }

    await queue.close();

    return NextResponse.json({ success: true, action, queue: queueName });
  } catch (error) {
    console.error("[admin/queues]", error);
    return NextResponse.json(
      { error: "操作失败" },
      { status: 500 }
    );
  }
}
