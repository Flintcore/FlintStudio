import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import { Prisma } from "@prisma/client";
import { RUN_STATUS, type RunStatus } from "./types";
import { getAgentNameForStepKey } from "./types";
import { getQueueByType, getQueueTypeByTaskType } from "@/lib/task/queues";
import { TASK_TYPE, type TaskType } from "@/lib/task/types";

export type CreateRunInput = {
  userId: string;
  projectId: string;
  workflowId: string;
  input: Record<string, unknown>;
};

export async function createRun(input: CreateRunInput) {
  const run = await prisma.graphRun.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      workflowId: input.workflowId,
      status: RUN_STATUS.QUEUED,
      input: input.input as object,
      currentPhase: "analyze_novel",
    },
  });
  await prisma.graphStep.create({
    data: {
      runId: run.id,
      stepKey: "analyze_novel",
      stepTitle: "剧本分析",
      status: "pending",
      stepIndex: 0,
      payload: { agent: getAgentNameForStepKey("analyze_novel") } as object,
    },
  });
  return { run };
}

/** 启动工作流：创建 analyze_novel 任务并入队 */
export async function startRunFirstStep(runId: string, input: Record<string, unknown>) {
  const run = await getRunById(runId);
  if (!run || run.status !== RUN_STATUS.QUEUED) return null;

  const novelText = String(input?.novelText ?? "").trim();
  if (!novelText) return null;

  const np = await prisma.novelPromotionProject.findFirst({
    where: { projectId: run.projectId },
  });
  if (!np) return null;

  const task = await prisma.task.create({
    data: {
      userId: run.userId,
      projectId: run.projectId,
      runId,
      type: TASK_TYPE.ANALYZE_NOVEL,
      targetType: "NovelPromotionProject",
      targetId: np.id,
      status: "queued",
      payload: { novelText: novelText.slice(0, 50000) } as object,
    },
  });

  const step = run.steps.find((s) => s.stepKey === "analyze_novel");
  if (step) {
    await prisma.graphStep.update({
      where: { id: step.id },
      data: { taskId: task.id, status: "running", startedAt: new Date() },
    });
  }

  await prisma.graphRun.update({
    where: { id: runId },
    data: { status: RUN_STATUS.RUNNING, startedAt: new Date() },
  });

  const queue = getQueueByType(getQueueTypeByTaskType(TASK_TYPE.ANALYZE_NOVEL));
  await queue.add(
    "analyze-novel",
    {
      taskId: task.id,
      type: TASK_TYPE.ANALYZE_NOVEL,
      userId: run.userId,
      projectId: run.projectId,
      runId,
      targetType: "NovelPromotionProject",
      targetId: np.id,
      payload: { novelText: novelText.slice(0, 50000) },
    },
    { jobId: task.id }
  );

  return task;
}

export async function getRunById(runId: string) {
  return prisma.graphRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { stepIndex: "asc" } } },
  });
}

/** 由 Worker 在任务开始时写入当步输入摘要，便于可观测与审计 */
export async function updateStepInputSummary(
  runId: string,
  taskId: string,
  inputSummary: Record<string, unknown>
) {
  const step = await prisma.graphStep.findFirst({
    where: { runId, taskId },
  });
  if (!step) return;
  const payload = (step.payload ?? {}) as Record<string, unknown>;
  await prisma.graphStep.update({
    where: { id: step.id },
    data: {
      payload: { ...payload, inputSummary } as object,
    },
  });
}

export async function listRuns(opts: {
  userId: string;
  projectId?: string;
  workflowId?: string;
  status?: RunStatus;
  queuedSince?: Date;
  queuedUntil?: Date;
  limit?: number;
}) {
  return prisma.graphRun.findMany({
    where: {
      userId: opts.userId,
      ...(opts.projectId && { projectId: opts.projectId }),
      ...(opts.workflowId && { workflowId: opts.workflowId }),
      ...(opts.status && { status: opts.status }),
      ...((opts.queuedSince ?? opts.queuedUntil) && {
        queuedAt: {
          ...(opts.queuedSince && { gte: opts.queuedSince }),
          ...(opts.queuedUntil && { lte: opts.queuedUntil }),
        },
      }),
    },
    orderBy: { queuedAt: "desc" },
    take: Math.min(opts.limit ?? 20, 100),
    include: { steps: { orderBy: { stepIndex: "asc" } } },
  });
}

/** 创建步骤和任务的通用函数（DB 部分使用事务，入队在事务成功后执行） */
async function createStepAndTask(
  runId: string,
  run: { id: string; userId: string; projectId: string },
  stepKey: string,
  stepTitle: string,
  stepIndex: number,
  taskType: string,
  targetType: string,
  targetId: string,
  episodeId?: string,
  payload?: Record<string, unknown>
) {
  const { step, task } = await prisma.$transaction(async (tx) => {
    const createdStep = await tx.graphStep.create({
      data: {
        runId,
        stepKey,
        stepTitle,
        status: "pending",
        stepIndex,
        payload: { agent: getAgentNameForStepKey(stepKey), ...(payload ?? {}) } as object,
      },
    });

    const createdTask = await tx.task.create({
      data: {
        userId: run.userId,
        projectId: run.projectId,
        episodeId,
        runId,
        type: taskType,
        targetType,
        targetId,
        status: "queued",
        payload: payload as object,
      },
    });

    await tx.graphStep.update({
      where: { id: createdStep.id },
      data: { taskId: createdTask.id, status: "running", startedAt: new Date() },
    });

    return { step: createdStep, task: createdTask };
  });

  return { step, task };
}

/** 将任务加入队列 */
async function enqueueTask(
  taskType: TaskType,
  jobName: string,
  data: {
    taskId: string;
    type: TaskType;
    userId: string;
    projectId: string;
    runId: string;
    targetType: string;
    targetId: string;
    episodeId?: string;
    payload?: Record<string, unknown>;
  }
) {
  const queue = getQueueByType(getQueueTypeByTaskType(taskType));
  await queue.add(jobName, data, { jobId: data.taskId });
}

/** 标记某步完成并推进工作流（由 Worker 在任务完成后调用） */
export async function advanceRun(runId: string, taskId: string) {
  const run = await getRunById(runId);
  if (!run || run.status !== RUN_STATUS.RUNNING) return;

  const step = run.steps.find((s) => s.taskId === taskId);
  if (!step || step.status !== "running") return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { result: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.graphStep.update({
      where: { id: step.id },
      data: {
        status: "completed",
        finishedAt: new Date(),
        ...(task?.result != null ? { result: task.result as object } : {}),
      },
    });
  });

  // 分布式锁保护 phase 切换，避免多 Worker 并发重复创建下一步骤
  const lockKey = `flint:advance:${runId}`;
  const acquired = await redis.set(lockKey, "1", "EX", 60, "NX");
  if (!acquired) return;

  try {
    // phase 切换前再次确认 run 状态，避免重复推进
    const runFresh = await getRunById(runId);
    if (!runFresh || runFresh.status !== RUN_STATUS.RUNNING) return;

    const phase = runFresh.currentPhase as string;
    const steps = runFresh.steps;

  if (phase === "analyze_novel") {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { result: true },
    });
    const result = (task?.result ?? {}) as {
      episodeIds?: string[];
      review?: { passed?: boolean; issues?: string[] };
    };
    const episodeIds = result.episodeIds ?? [];
    const review = result.review;

    if (episodeIds.length === 0) {
      await finishRun(runId, RUN_STATUS.COMPLETED, { message: "无集数可处理" });
      return;
    }

    if (review && review.passed === false && Array.isArray(review.issues) && review.issues.length > 0) {
      await pauseRunForReview(runId, review.issues);
      return;
    }

    await createStoryToScriptSteps(runId, runFresh, episodeIds);
    return;
  }

  if (phase === "story_to_script") {
    const storySteps = steps.filter((s) => s.stepKey.startsWith("story_to_script"));
    const allDone = storySteps.length > 0 && storySteps.every((s) => s.status === "completed");
    if (!allDone) return;

    const np = await prisma.novelPromotionProject.findFirst({
      where: { projectId: runFresh.projectId },
    });
    if (!np) {
      await finishRun(runId, RUN_STATUS.FAILED, { error: "项目数据不存在" });
      return;
    }
    const episodes = await prisma.novelPromotionEpisode.findMany({
      where: { novelPromotionProjectId: np.id },
      orderBy: { episodeNumber: "asc" },
      include: { clips: true },
    });
    const episodesWithClips = episodes.filter((ep) => ep.clips.length > 0);
    if (episodesWithClips.length === 0) {
      await prisma.graphRun.update({
        where: { id: runId },
        data: { currentPhase: "script_to_storyboard" },
      });
      const anyPending = (await getRunById(runId))?.steps.some(
        (s) => s.status === "pending" || s.status === "running"
      );
      if (!anyPending) await finishRun(runId, RUN_STATUS.COMPLETED, { message: "无分场可生成分镜" });
      return;
    }

    const existingScriptSteps = steps.filter((s) => s.stepKey.startsWith("script_to_storyboard"));
    if (existingScriptSteps.length > 0) return;

    await prisma.graphRun.update({
      where: { id: runId },
      data: { currentPhase: "script_to_storyboard" },
    });

    for (let i = 0; i < episodesWithClips.length; i++) {
      const ep = episodesWithClips[i];
      const stepKey = `script_to_storyboard_${i}`;
      const { task } = await createStepAndTask(
        runId,
        runFresh,
        stepKey,
        `分镜·第${ep.episodeNumber}集`,
        10 + i,
        TASK_TYPE.SCRIPT_TO_STORYBOARD,
        "NovelPromotionEpisode",
        ep.id,
        ep.id,
        { episodeId: ep.id }
      );
      await enqueueTask(TASK_TYPE.SCRIPT_TO_STORYBOARD, "script-to-storyboard", {
        taskId: task.id,
        type: TASK_TYPE.SCRIPT_TO_STORYBOARD,
        userId: runFresh.userId,
        projectId: runFresh.projectId,
        episodeId: ep.id,
        runId,
        targetType: "NovelPromotionEpisode",
        targetId: ep.id,
        payload: { episodeId: ep.id },
      });
    }
    return;
  }

  if (phase === "script_to_storyboard") {
    const scriptSteps = steps.filter((s) => s.stepKey.startsWith("script_to_storyboard"));
    const allDone = scriptSteps.length > 0 && scriptSteps.every((s) => s.status === "completed");
    if (!allDone) return;

    const np = await prisma.novelPromotionProject.findFirst({
      where: { projectId: runFresh.projectId },
    });
    if (!np) {
      await finishRun(runId, RUN_STATUS.FAILED, { error: "项目数据不存在" });
      return;
    }
    const episodes = await prisma.novelPromotionEpisode.findMany({
      where: { novelPromotionProjectId: np.id },
      include: { storyboards: { include: { panels: true } } },
    });
    const episodesWithPanels = episodes.filter(
      (ep) => ep.storyboards.some((sb) => sb.panels.length > 0)
    );
    if (episodesWithPanels.length === 0) {
      await prisma.graphRun.update({
        where: { id: runId },
        data: { currentPhase: "image_panels" },
      });
      const runAfter = await getRunById(runId);
      const anyPending = runAfter?.steps.some(
        (s) => s.status === "pending" || s.status === "running"
      );
      if (!anyPending) await finishRun(runId, RUN_STATUS.COMPLETED, { message: "无分镜可出图" });
      return;
    }

    const existingImageSteps = steps.filter((s) => s.stepKey.startsWith("image_panels"));
    if (existingImageSteps.length > 0) return;

    await prisma.graphRun.update({
      where: { id: runId },
      data: { currentPhase: "image_panels" },
    });

    for (let i = 0; i < episodesWithPanels.length; i++) {
      const ep = episodesWithPanels[i];
      const stepKey = `image_panels_${i}`;
      const { task } = await createStepAndTask(
        runId,
        runFresh,
        stepKey,
        `出图·第${ep.episodeNumber}集`,
        20 + i,
        TASK_TYPE.IMAGE_PANEL,
        "NovelPromotionEpisode",
        ep.id,
        ep.id,
        { episodeId: ep.id }
      );
      await enqueueTask(TASK_TYPE.IMAGE_PANEL, "image-panel", {
        taskId: task.id,
        type: TASK_TYPE.IMAGE_PANEL,
        userId: runFresh.userId,
        projectId: runFresh.projectId,
        episodeId: ep.id,
        runId,
        targetType: "NovelPromotionEpisode",
        targetId: ep.id,
        payload: { episodeId: ep.id },
      });
    }
    return;
  }

  if (phase === "image_panels") {
    const imageSteps = steps.filter((s) => s.stepKey.startsWith("image_panels"));
    const allDone = imageSteps.length > 0 && imageSteps.every((s) => s.status === "completed");
    if (!allDone) return;

    const np = await prisma.novelPromotionProject.findFirst({
      where: { projectId: runFresh.projectId },
    });
    if (!np) {
      await finishRun(runId, RUN_STATUS.FAILED, { error: "项目数据不存在" });
      return;
    }
    const episodesForVoice = await prisma.novelPromotionEpisode.findMany({
      where: { novelPromotionProjectId: np.id },
      include: { storyboards: { include: { panels: true } }, clips: true },
    });
    const episodesWithContent = episodesForVoice.filter(
      (ep) => ep.clips.length > 0 && ep.storyboards.some((sb) => sb.panels.length > 0)
    );
    if (episodesWithContent.length === 0) {
      await prisma.graphRun.update({
        where: { id: runId },
        data: { currentPhase: "voice" },
      });
      const runAfter = await getRunById(runId);
      const anyPending = runAfter?.steps.some(
        (s) => s.status === "pending" || s.status === "running"
      );
      if (!anyPending) await finishRun(runId, RUN_STATUS.COMPLETED, { message: "无可用集数进行配音" });
      return;
    }

    const existingVoiceSteps = steps.filter((s) => s.stepKey.startsWith("voice_"));
    if (existingVoiceSteps.length > 0) return;

    await prisma.graphRun.update({
      where: { id: runId },
      data: { currentPhase: "voice" },
    });

    for (let i = 0; i < episodesWithContent.length; i++) {
      const ep = episodesWithContent[i];
      const stepKey = `voice_${i}`;
      const { task } = await createStepAndTask(
        runId,
        runFresh,
        stepKey,
        `配音·第${ep.episodeNumber}集`,
        30 + i,
        TASK_TYPE.VOICE_LINE,
        "NovelPromotionEpisode",
        ep.id,
        ep.id,
        { episodeId: ep.id }
      );
      await enqueueTask(TASK_TYPE.VOICE_LINE, "voice-line", {
        taskId: task.id,
        type: TASK_TYPE.VOICE_LINE,
        userId: runFresh.userId,
        projectId: runFresh.projectId,
        episodeId: ep.id,
        runId,
        targetType: "NovelPromotionEpisode",
        targetId: ep.id,
        payload: { episodeId: ep.id },
      });
    }
    return;
  }

  if (phase === "voice") {
    const voiceSteps = steps.filter((s) => s.stepKey.startsWith("voice_"));
    const allDone = voiceSteps.length > 0 && voiceSteps.every((s) => s.status === "completed");
    if (!allDone) return;

    const np = await prisma.novelPromotionProject.findFirst({
      where: { projectId: runFresh.projectId },
    });
    if (!np) {
      await finishRun(runId, RUN_STATUS.FAILED, { error: "项目数据不存在" });
      return;
    }
    const episodesForVideo = await prisma.novelPromotionEpisode.findMany({
      where: { novelPromotionProjectId: np.id },
      include: { voiceLines: { orderBy: { lineIndex: "asc" } } },
    });
    const episodesWithVoice = episodesForVideo.filter((ep) => ep.voiceLines.length > 0);
    if (episodesWithVoice.length === 0) {
      await prisma.graphRun.update({
        where: { id: runId },
        data: { currentPhase: "video" },
      });
      const runAfter = await getRunById(runId);
      const anyPending = runAfter?.steps.some(
        (s) => s.status === "pending" || s.status === "running"
      );
      if (!anyPending) await finishRun(runId, RUN_STATUS.COMPLETED, { message: "无配音可合成视频" });
      return;
    }

    const existingVideoSteps = steps.filter((s) => s.stepKey.startsWith("video_"));
    if (existingVideoSteps.length > 0) return;

    await prisma.graphRun.update({
      where: { id: runId },
      data: { currentPhase: "video" },
    });

    for (let i = 0; i < episodesWithVoice.length; i++) {
      const ep = episodesWithVoice[i];
      const stepKey = `video_${i}`;
      const { task } = await createStepAndTask(
        runId,
        runFresh,
        stepKey,
        `视频合成·第${ep.episodeNumber}集`,
        40 + i,
        TASK_TYPE.VIDEO_PANEL,
        "NovelPromotionEpisode",
        ep.id,
        ep.id,
        { episodeId: ep.id }
      );
      await enqueueTask(TASK_TYPE.VIDEO_PANEL, "video-episode", {
        taskId: task.id,
        type: TASK_TYPE.VIDEO_PANEL,
        userId: runFresh.userId,
        projectId: runFresh.projectId,
        episodeId: ep.id,
        runId,
        targetType: "NovelPromotionEpisode",
        targetId: ep.id,
        payload: { episodeId: ep.id },
      });
    }
    return;
  }

  if (phase === "video") {
    const videoSteps = steps.filter((s) => s.stepKey.startsWith("video_"));
    const allDone = videoSteps.length > 0 && videoSteps.every((s) => s.status === "completed");
    if (allDone) {
      await finishRun(runId, RUN_STATUS.COMPLETED, {
        message: "全流程完成：剧本分析 → 分场 → 分镜 → 出图 → 配音 → 视频合成，可前往集详情页观看成片",
      });
    }
    return;
  }

  const anyStepPending = steps.some((s) => s.status === "pending" || s.status === "running");
  if (!anyStepPending) {
    await finishRun(runId, RUN_STATUS.COMPLETED, {});
  }
  } finally {
    await redis.del(lockKey);
  }
}

async function finishRun(runId: string, status: RunStatus, output: Record<string, unknown>) {
  await prisma.graphRun.update({
    where: { id: runId },
    data: {
      status,
      output: output as object,
      finishedAt: new Date(),
      currentPhase: null,
    },
  });
}

export async function failRun(runId: string, errorMessage: string) {
  await prisma.graphRun.update({
    where: { id: runId },
    data: {
      status: RUN_STATUS.FAILED,
      errorMessage,
      finishedAt: new Date(),
    },
  });
}

/** 复查未通过时暂停，等待用户「继续执行」 */
async function pauseRunForReview(runId: string, issues: string[]) {
  await prisma.graphRun.update({
    where: { id: runId },
    data: {
      currentPhase: "review_failed",
      output: {
        message: "复查未通过，请检查后点击「继续执行」或重跑工作流",
        issues,
      } as object,
    },
  });
}

/** 从「复查未通过」状态继续，创建分场步骤并推进 */
export async function continueRunAfterReview(runId: string): Promise<boolean> {
  const run = await getRunById(runId);
  if (!run || run.currentPhase !== "review_failed") return false;

  const analyzeStep = run.steps.find((s) => s.stepKey === "analyze_novel");
  const result = (analyzeStep?.result ?? {}) as { episodeIds?: string[] };
  const episodeIds = result.episodeIds ?? [];
  if (episodeIds.length === 0) return false;

  await prisma.graphRun.update({
    where: { id: runId },
    data: { currentPhase: "story_to_script", output: Prisma.JsonNull },
  });

  await createStoryToScriptSteps(runId, run, episodeIds);
  return true;
}

/** 复查未通过时「重试剧本分析」：重新入队 analyze_novel，使用 run.input 中的 novelText */
export async function retryAnalyzeNovel(runId: string): Promise<boolean> {
  const run = await getRunById(runId);
  if (!run || run.currentPhase !== "review_failed") return false;

  const novelText = String((run.input as { novelText?: string })?.novelText ?? "").trim();
  if (!novelText) return false;

  const np = await prisma.novelPromotionProject.findFirst({
    where: { projectId: run.projectId },
  });
  if (!np) return false;

  const step = run.steps.find((s) => s.stepKey === "analyze_novel");
  if (!step) return false;

  await prisma.graphStep.update({
    where: { id: step.id },
    data: {
      status: "pending",
      taskId: null,
      result: Prisma.JsonNull,
      startedAt: null,
      finishedAt: null,
    },
  });

  const task = await prisma.task.create({
    data: {
      userId: run.userId,
      projectId: run.projectId,
      runId,
      type: TASK_TYPE.ANALYZE_NOVEL,
      targetType: "NovelPromotionProject",
      targetId: np.id,
      status: "queued",
      payload: { novelText: novelText.slice(0, 50000) } as object,
    },
  });

  await prisma.graphStep.update({
    where: { id: step.id },
    data: { taskId: task.id, status: "running", startedAt: new Date() },
  });

  await prisma.graphRun.update({
    where: { id: runId },
    data: {
      status: RUN_STATUS.RUNNING,
      currentPhase: "analyze_novel",
      output: Prisma.JsonNull,
    },
  });

  const queue = getQueueByType(getQueueTypeByTaskType(TASK_TYPE.ANALYZE_NOVEL));
  await queue.add(
    "analyze-novel",
    {
      taskId: task.id,
      type: TASK_TYPE.ANALYZE_NOVEL,
      userId: run.userId,
      projectId: run.projectId,
      runId,
      targetType: "NovelPromotionProject",
      targetId: np.id,
      payload: { novelText: novelText.slice(0, 50000) },
    },
    { jobId: task.id }
  );

  return true;
}

/** 根据剧本分析结果创建分场步骤并入队 */
async function createStoryToScriptSteps(
  runId: string,
  run: { id: string; userId: string; projectId: string },
  episodeIds: string[]
) {
  for (let i = 0; i < episodeIds.length; i++) {
    const episodeId = episodeIds[i];
    const { task } = await createStepAndTask(
      runId,
      run,
      `story_to_script_${i}`,
      `分场·第${i + 1}集`,
      1 + i,
      TASK_TYPE.STORY_TO_SCRIPT,
      "NovelPromotionEpisode",
      episodeId,
      episodeId,
      { episodeId }
    );
    await enqueueTask(TASK_TYPE.STORY_TO_SCRIPT, "story-to-script", {
      taskId: task.id,
      type: TASK_TYPE.STORY_TO_SCRIPT,
      userId: run.userId,
      projectId: run.projectId,
      episodeId,
      runId,
      targetType: "NovelPromotionEpisode",
      targetId: episodeId,
      payload: { episodeId },
    });
  }
  await prisma.graphRun.update({
    where: { id: runId },
    data: { currentPhase: "story_to_script" },
  });
}
