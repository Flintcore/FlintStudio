import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getRunById } from "@/lib/workflow/service";

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

  return NextResponse.json({
    id: run.id,
    workflowId: run.workflowId,
    status: run.status,
    currentPhase: run.currentPhase,
    errorMessage: run.errorMessage,
    input: run.input,
    output: run.output,
    steps: run.steps.map((s) => ({
      stepKey: s.stepKey,
      stepTitle: s.stepTitle,
      status: s.status,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
    })),
    queuedAt: run.queuedAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  });
}
