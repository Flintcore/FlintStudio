/**
 * 数据库批量操作工具
 * 减少数据库往返次数，提高性能
 */

import { prisma } from "./db";
import { logger } from "./logger";

/**
 * 批量更新项目进度
 */
export async function batchUpdateTaskProgress(
  updates: Array<{
    taskId: string;
    status: string;
    progress: number;
    result?: unknown;
    errorMessage?: string;
  }>
) {
  if (updates.length === 0) return;

  const start = Date.now();

  try {
    await prisma.$transaction(
      updates.map((update) =>
        prisma.task.update({
          where: { id: update.taskId },
          data: {
            status: update.status,
            progress: update.progress,
            result: update.result ? JSON.stringify(update.result) : undefined,
            errorMessage: update.errorMessage,
            finishedAt:
              update.status === "completed" || update.status === "failed"
                ? new Date()
                : undefined,
          },
        })
      )
    );

    logger.debug(
      {
        type: "batch_update",
        count: updates.length,
        duration: Date.now() - start,
      },
      `Batch updated ${updates.length} tasks`
    );
  } catch (error) {
    logger.error(
      {
        type: "batch_update_error",
        count: updates.length,
        error: (error as Error).message,
      },
      `Batch update failed`
    );
    throw error;
  }
}

/**
 * 批量创建工作流步骤
 */
export async function batchCreateGraphSteps(
  runId: string,
  steps: Array<{
    stepKey: string;
    stepTitle: string;
    stepIndex: number;
    payload?: unknown;
  }>
) {
  if (steps.length === 0) return;

  await prisma.graphStep.createMany({
    data: steps.map((step) => ({
      runId,
      stepKey: step.stepKey,
      stepTitle: step.stepTitle,
      stepIndex: step.stepIndex,
      payload: step.payload ? JSON.stringify(step.payload) : undefined,
      status: "pending",
    })),
    skipDuplicates: true,
  });
}

/**
 * 预加载剧集数据（减少 N+1）
 */
export async function preloadEpisodeData(episodeId: string) {
  return prisma.novelPromotionEpisode.findUnique({
    where: { id: episodeId },
    include: {
      novelPromotionProject: {
        include: {
          project: true,
        },
      },
      storyboards: {
        include: {
          panels: true,
        },
      },
      voiceLines: true,
    },
  });
}
