import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getQueueByType, getQueueTypeByTaskType } from "@/lib/task/queues";
import { TASK_TYPE, type TaskJobData } from "@/lib/task/types";

/**
 * 提交剧本分析任务：将小说文本解析为角色、场景、集数。
 * 需在设置中配置 LLM API。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getCurrentSession();
    const { projectId } = await params;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: { novelPromotion: true },
    });
    if (!project?.novelPromotion) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const novelText = (body.novelText ?? body.text ?? "").trim();
    if (!novelText) {
      return NextResponse.json(
        { error: "请提供 novelText 或 text" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        userId: session.user.id,
        projectId,
        type: TASK_TYPE.ANALYZE_NOVEL,
        targetType: "NovelPromotionProject",
        targetId: project.novelPromotion.id,
        status: "queued",
        payload: { novelText: novelText.slice(0, 50_000) },
      },
    });

    const queue = getQueueByType(getQueueTypeByTaskType(TASK_TYPE.ANALYZE_NOVEL));
    await (queue as unknown as { add: (name: string, data: TaskJobData, opts?: { jobId?: string }) => Promise<unknown> }).add(
      "analyze-novel",
      {
        taskId: task.id,
        type: TASK_TYPE.ANALYZE_NOVEL,
        userId: session.user.id,
        projectId,
        targetType: "NovelPromotionProject",
        targetId: project.novelPromotion.id,
        payload: { novelText: novelText.slice(0, 50_000) },
      },
      { jobId: task.id }
    );

    return NextResponse.json({ taskId: task.id, status: "queued" });
  } catch (e) {
    console.error("[projects/analyze]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "提交分析失败" },
      { status: 500 }
    );
  }
}
