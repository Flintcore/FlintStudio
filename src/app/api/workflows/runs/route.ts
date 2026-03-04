import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { listRuns } from "@/lib/workflow/service";

export async function GET(req: Request) {
  const session = await getCurrentSession();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const queuedSince = searchParams.get("queuedSince") ?? undefined;
  const queuedUntil = searchParams.get("queuedUntil") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);

  const runs = await listRuns({
    userId: session.user.id,
    projectId,
    ...(status && { status: status as "queued" | "running" | "completed" | "failed" | "canceled" }),
    ...(queuedSince && { queuedSince: new Date(queuedSince) }),
    ...(queuedUntil && { queuedUntil: new Date(queuedUntil) }),
    limit,
  });

  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      workflowId: r.workflowId,
      status: r.status,
      currentPhase: r.currentPhase,
      errorMessage: r.errorMessage,
      queuedAt: r.queuedAt,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      stepsCount: r.steps.length,
    })),
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
