import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { listRuns } from "@/lib/workflow/service";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);

  const runs = await listRuns({
    userId: session.user.id,
    projectId,
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
