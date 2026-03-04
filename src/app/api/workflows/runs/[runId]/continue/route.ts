import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getRunById, continueRunAfterReview } from "@/lib/workflow/service";

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await getCurrentSession();
  const { runId } = await params;

  const run = await getRunById(runId);
  if (!run || run.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (run.currentPhase !== "review_failed") {
    return NextResponse.json(
      { error: "当前运行未处于复查未通过状态，无法继续执行" },
      { status: 400 }
    );
  }

  try {
    const continued = await continueRunAfterReview(runId);
    if (!continued) {
      return NextResponse.json(
        { error: "继续执行失败（无集数或状态异常）" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[continue run]", e);
    return NextResponse.json(
      { error: (e as Error).message ?? "继续执行失败" },
      { status: 500 }
    );
  }
}
