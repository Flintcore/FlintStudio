import { prisma } from "@/lib/db";
import { RUN_STATUS, type RunStatus } from "./types";
import { getQueueByType, getQueueTypeByTaskType } from "@/lib/task/queues";
import { TASK_TYPE } from "@/lib/task/types";

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
      payload: { novelText: novelText.slice(0, 50000) },
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

export async function listRuns(opts: {
  userId: string;
  projectId?: string;
  workflowId?: string;
  status?: RunStatus;
  limit?: number;
}) {
  return prisma.graphRun.findMany({
    where: {
      userId: opts.userId,
      ...(opts.projectId && { projectId: opts.projectId }),
      ...(opts.workflowId && { workflowId: opts.workflowId }),
      ...(opts.status && { status: opts.status }),
    },
    orderBy: { queuedAt: "desc" },
    take: Math.min(opts.limit ?? 20, 100),
    include: { steps: { orderBy: { stepIndex: "asc" } } },
  });
}

/** 标记某步完成并推进工作流（由 Worker 在任务完成后调用） */
export async function advanceRun(runId: string, taskId: string) {
  const run = await getRunById(runId);
  if (!run || run.status !== RUN_STATUS.RUNNING) return;

  const step = run.steps.find((s) => s.taskId === taskId);
  if (!step || step.status !== "running") return;

  await prisma.graphStep.update({
    where: { id: step.id },
    data: { status: "completed", finishedAt: new Date() },
  });

  const runFresh = await getRunById(runId);
  const phase = (runFresh ?? run).currentPhase as string;
  const steps = (runFresh ?? run).steps;

  if (phase === "analyze_novel") {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { result: true },
    });
    const result = (task?.result ?? {}) as { episodeIds?: string[] };
    const episodeIds = result.episodeIds ?? [];

    if (episodeIds.length === 0) {
      await finishRun(runId, RUN_STATUS.COMPLETED, { message: "无集数可处理" });
      return;
    }

    for (let i = 0; i < episodeIds.length; i++) {
      const episodeId = episodeIds[i];
      await prisma.graphStep.create({
        data: {
          runId,
          stepKey: `story_to_script_${i}`,
          stepTitle: `分场·第${i + 1}集`,
          status: "pending",
          stepIndex: 1 + i,
        },
      });
      const t = await prisma.task.create({
        data: {
          userId: run.userId,
          projectId: run.projectId,
          episodeId,
          runId,
          type: TASK_TYPE.STORY_TO_SCRIPT,
          targetType: "NovelPromotionEpisode",
          targetId: episodeId,
          status: "queued",
          payload: { episodeId },
        },
      });
      const stepRow = await prisma.graphStep.findFirst({
        where: { runId, stepKey: `story_to_script_${i}` },
      });
      if (stepRow) {
        await prisma.graphStep.update({
          where: { id: stepRow.id },
          data: { taskId: t.id, status: "running", startedAt: new Date() },
        });
      }
      const queue = getQueueByType(getQueueTypeByTaskType(TASK_TYPE.STORY_TO_SCRIPT));
      await queue.add(
        "story-to-script",
        {
          taskId: t.id,
          type: TASK_TYPE.STORY_TO_SCRIPT,
          userId: run.userId,
          projectId: run.projectId,
          episodeId,
          runId,
          targetType: "NovelPromotionEpisode",
          targetId: episodeId,
          payload: { episodeId },
        },
        { jobId: t.id }
      );
    }
    await prisma.graphRun.update({
      where: { id: runId },
      data: { currentPhase: "story_to_script" },
    });
    return;
  }

  if (phase === "story_to_script") {
    const storySteps = steps.filter((s) => s.stepKey.startsWith("story_to_script"));
    const allDone = storySteps.length > 0 && storySteps.every((s) => s.status === "completed");
    if (!allDone) return;

    const np = await prisma.novelPromotionProject.findFirst({
      where: { projectId: run.projectId },
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
      await prisma.graphStep.create({
        data: {
          runId,
          stepKey,
          stepTitle: `分镜·第${ep.episodeNumber}集`,
          status: "pending",
          stepIndex: 10 + i,
        },
      });
      const t = await prisma.task.create({
        data: {
          userId: run.userId,
          projectId: run.projectId,
          episodeId: ep.id,
          runId,
          type: TASK_TYPE.SCRIPT_TO_STORYBOARD,
          targetType: "NovelPromotionEpisode",
          targetId: ep.id,
          status: "queued",
          payload: { episodeId: ep.id },
        },
      });
      const stepRow = await prisma.graphStep.findFirst({
        where: { runId, stepKey },
      });
      if (stepRow) {
        await prisma.graphStep.update({
          where: { id: stepRow.id },
          data: { taskId: t.id, status: "running", startedAt: new Date() },
        });
      }
      const queue = getQueueByType(getQueueTypeByTaskType(TASK_TYPE.SCRIPT_TO_STORYBOARD));
      await queue.add(
        "script-to-storyboard",
        {
          taskId: t.id,
          type: TASK_TYPE.SCRIPT_TO_STORYBOARD,
          userId: run.userId,
          projectId: run.projectId,
          episodeId: ep.id,
          runId,
          targetType: "NovelPromotionEpisode",
          targetId: ep.id,
          payload: { episodeId: ep.id },
        },
        { jobId: t.id }
      );
    }
    return;
  }

  if (phase === "script_to_storyboard") {
    const scriptSteps = steps.filter((s) => s.stepKey.startsWith("script_to_storyboard"));
    const allDone = scriptSteps.length > 0 && scriptSteps.every((s) => s.status === "completed");
    if (!allDone) return;

    const np = await prisma.novelPromotionProject.findFirst({
      where: { projectId: run.projectId },
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
      await prisma.graphStep.create({
        data: {
          runId,
          stepKey,
          stepTitle: `出图·第${ep.episodeNumber}集`,
          status: "pending",
          stepIndex: 20 + i,
        },
      });
      const t = await prisma.task.create({
        data: {
          userId: run.userId,
          projectId: run.projectId,
          episodeId: ep.id,
          runId,
          type: TASK_TYPE.IMAGE_PANEL,
          targetType: "NovelPromotionEpisode",
          targetId: ep.id,
          status: "queued",
          payload: { episodeId: ep.id },
        },
      });
      const stepRow = await prisma.graphStep.findFirst({
        where: { runId, stepKey },
      });
      if (stepRow) {
        await prisma.graphStep.update({
          where: { id: stepRow.id },
          data: { taskId: t.id, status: "running", startedAt: new Date() },
        });
      }
      const queue = getQueueByType(getQueueTypeByTaskType(TASK_TYPE.IMAGE_PANEL));
      await queue.add(
        "image-panel",
        {
          taskId: t.id,
          type: TASK_TYPE.IMAGE_PANEL,
          userId: run.userId,
          projectId: run.projectId,
          episodeId: ep.id,
          runId,
          targetType: "NovelPromotionEpisode",
          targetId: ep.id,
          payload: { episodeId: ep.id },
        },
        { jobId: t.id }
      );
    }
    return;
  }

  if (phase === "image_panels") {
    const imageSteps = steps.filter((s) => s.stepKey.startsWith("image_panels"));
    const allDone = imageSteps.length > 0 && imageSteps.every((s) => s.status === "completed");
    if (!allDone) return;

    const np = await prisma.novelPromotionProject.findFirst({
      where: { projectId: run.projectId },
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
      await prisma.graphStep.create({
        data: {
          runId,
          stepKey,
          stepTitle: `配音·第${ep.episodeNumber}集`,
          status: "pending",
          stepIndex: 30 + i,
        },
      });
      const t = await prisma.task.create({
        data: {
          userId: run.userId,
          projectId: run.projectId,
          episodeId: ep.id,
          runId,
          type: TASK_TYPE.VOICE_LINE,
          targetType: "NovelPromotionEpisode",
          targetId: ep.id,
          status: "queued",
          payload: { episodeId: ep.id },
        },
      });
      const stepRow = await prisma.graphStep.findFirst({
        where: { runId, stepKey },
      });
      if (stepRow) {
        await prisma.graphStep.update({
          where: { id: stepRow.id },
          data: { taskId: t.id, status: "running", startedAt: new Date() },
        });
      }
      const queue = getQueueByType(getQueueTypeByTaskType(TASK_TYPE.VOICE_LINE));
      await queue.add(
        "voice-line",
        {
          taskId: t.id,
          type: TASK_TYPE.VOICE_LINE,
          userId: run.userId,
          projectId: run.projectId,
          episodeId: ep.id,
          runId,
          targetType: "NovelPromotionEpisode",
          targetId: ep.id,
          payload: { episodeId: ep.id },
        },
        { jobId: t.id }
      );
    }
    return;
  }

  if (phase === "voice") {
    const voiceSteps = steps.filter((s) => s.stepKey.startsWith("voice_"));
    const allDone = voiceSteps.length > 0 && voiceSteps.every((s) => s.status === "completed");
    if (!allDone) return;

    const np = await prisma.novelPromotionProject.findFirst({
      where: { projectId: run.projectId },
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
      await prisma.graphStep.create({
        data: {
          runId,
          stepKey,
          stepTitle: `视频合成·第${ep.episodeNumber}集`,
          status: "pending",
          stepIndex: 40 + i,
        },
      });
      const t = await prisma.task.create({
        data: {
          userId: run.userId,
          projectId: run.projectId,
          episodeId: ep.id,
          runId,
          type: TASK_TYPE.VIDEO_PANEL,
          targetType: "NovelPromotionEpisode",
          targetId: ep.id,
          status: "queued",
          payload: { episodeId: ep.id },
        },
      });
      const stepRow = await prisma.graphStep.findFirst({
        where: { runId, stepKey },
      });
      if (stepRow) {
        await prisma.graphStep.update({
          where: { id: stepRow.id },
          data: { taskId: t.id, status: "running", startedAt: new Date() },
        });
      }
      const queue = getQueueByType(getQueueTypeByTaskType(TASK_TYPE.VIDEO_PANEL));
      await queue.add(
        "video-episode",
        {
          taskId: t.id,
          type: TASK_TYPE.VIDEO_PANEL,
          userId: run.userId,
          projectId: run.projectId,
          episodeId: ep.id,
          runId,
          targetType: "NovelPromotionEpisode",
          targetId: ep.id,
          payload: { episodeId: ep.id },
        },
        { jobId: t.id }
      );
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
