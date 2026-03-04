import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getRunById, retryAnalyzeNovel } from "@/lib/workflow/service";

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
      { error: "仅支持在复查未通过时重试剧本分析" },
      { status: 400 }
    );
  }

  try {
    const ok = await retryAnalyzeNovel(runId);
    if (!ok) {
      return NextResponse.json(
        { error: "重试失败（缺少原文或项目数据）" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[retry-analyze]", e);
    return NextResponse.json(
      { error: (e as Error).message ?? "重试失败" },
      { status: 500 }
    );
  }
}
