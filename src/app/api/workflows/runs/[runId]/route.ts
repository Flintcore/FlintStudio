import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getRunById } from "@/lib/workflow/service";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await getCurrentSession();

  const { runId } = await params;
  const run = await getRunById(runId);
  if (!run || run.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 查询当前 running 的图像任务进度
  let imageProgress: { done: number; total: number } | null = null;
  if (run.status === "running" && run.currentPhase === "image_panels") {
    const imageTasks = await prisma.task.findMany({
      where: { runId, type: "image-panel", status: "running" },
      select: { payload: true },
    });
    if (imageTasks.length > 0) {
      let totalDone = 0;
      let totalPanels = 0;
      for (const t of imageTasks) {
        const p = t.payload as { done?: number; total?: number } | null;
        totalDone += p?.done ?? 0;
        totalPanels += p?.total ?? 0;
      }
      if (totalPanels > 0) {
        imageProgress = { done: totalDone, total: totalPanels };
      }
    }
  }

  return NextResponse.json({
    id: run.id,
    workflowId: run.workflowId,
    status: run.status,
    currentPhase: run.currentPhase,
    errorMessage: run.errorMessage,
    input: run.input,
    output: run.output,
    imageProgress,
    steps: run.steps.map((s) => ({
      stepKey: s.stepKey,
      stepTitle: s.stepTitle,
      status: s.status,
      errorMessage: s.errorMessage ?? null,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      result: s.result ?? undefined,
      payload: s.payload ?? undefined,
    })),
    queuedAt: run.queuedAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
