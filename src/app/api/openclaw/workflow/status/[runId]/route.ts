import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/auth";
import { PHASES } from "@/lib/workflow/types";
import { verifyOpenclawBearer } from "@/lib/openclaw-internal-auth";

// GET: 查询工作流运行状态
export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    // 验证 token
    if (!(await verifyOpenclawBearer(req))) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { runId } = await params;
    const runIdStr = String(runId).trim();

    if (!runIdStr) {
      return NextResponse.json(
        { error: "Run ID is required" },
        { status: 400 }
      );
    }

    // 获取或创建默认用户
    const user = await getOrCreateDefaultUser();

    // 查询运行记录
    const run = await prisma.graphRun.findFirst({
      where: {
        id: runIdStr,
        userId: user.id,
      },
      include: {
        steps: {
          orderBy: { stepIndex: "asc" },
        },
      },
    });

    // 单独查询项目信息
    const project = run ? await prisma.project.findUnique({
      where: { id: run.projectId },
      select: { id: true, name: true },
    }) : null;

    if (!run) {
      return NextResponse.json(
        { error: "Workflow run not found" },
        { status: 404 }
      );
    }

    // 计算总体进度
    const totalSteps = run.steps.length;
    const completedSteps = run.steps.filter(
      (s: { status: string }) => s.status === "completed"
    ).length;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // 获取当前阶段索引
    const currentPhaseIndex = run.currentPhase
      ? PHASES.indexOf(run.currentPhase as typeof PHASES[number])
      : -1;

    // 获取所有 taskId 对应的 Task 信息
    const taskIds = run.steps
      .map((s: { taskId: string | null }) => s.taskId)
      .filter(Boolean) as string[];
    const tasks = taskIds.length > 0
      ? await prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: {
            id: true,
            status: true,
            progress: true,
            errorMessage: true,
          },
        })
      : [];
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    // 格式化步骤信息
    const formattedSteps = run.steps.map((step: {
      id: string;
      stepKey: string;
      stepTitle: string;
      status: string;
      stepIndex: number;
      taskId: string | null;
      startedAt: Date | null;
      finishedAt: Date | null;
      errorMessage: string | null;
      result: unknown;
    }) => {
      const task = step.taskId ? taskMap.get(step.taskId) : null;
      return {
        id: step.id,
        key: step.stepKey,
        title: step.stepTitle,
        status: step.status,
        index: step.stepIndex,
        taskId: step.taskId,
        taskStatus: task?.status,
        taskProgress: task?.progress,
        startedAt: step.startedAt,
        finishedAt: step.finishedAt,
        errorMessage: step.errorMessage || task?.errorMessage,
        result: step.result,
      };
    });

    // 计算预估剩余时间（简化估算）
    let estimatedRemainingSeconds: number | null = null;
    if (run.status === "running" && run.startedAt) {
      const elapsed = Date.now() - run.startedAt.getTime();
      const avgTimePerStep = elapsed / Math.max(1, completedSteps);
      const remainingSteps = totalSteps - completedSteps;
      estimatedRemainingSeconds = Math.round((avgTimePerStep * remainingSteps) / 1000);
    }

    return NextResponse.json({
      run: {
        id: run.id,
        workflowId: run.workflowId,
        status: run.status,
        currentPhase: run.currentPhase,
        progress,
        input: run.input,
        output: run.output,
        errorMessage: run.errorMessage,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        estimatedRemainingSeconds,
      },
      project,
      steps: formattedSteps,
      summary: {
        totalSteps,
        completedSteps,
        runningSteps: run.steps.filter((s: { status: string }) => s.status === "running").length,
        failedSteps: run.steps.filter((s: { status: string }) => s.status === "failed").length,
        pendingSteps: run.steps.filter((s: { status: string }) => s.status === "pending").length,
        currentPhaseIndex,
        totalPhases: PHASES.length,
      },
    });
  } catch (error) {
    console.error("[openclaw/workflow/status/[runId] GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get workflow status" },
      { status: 500 }
    );
  }
}
