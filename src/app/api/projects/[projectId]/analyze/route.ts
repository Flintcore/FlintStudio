import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getQueueByType, getQueueTypeByTaskType } from "@/lib/task/queues";
import { TASK_TYPE } from "@/lib/task/types";

/**
 * 提交剧本分析任务：将小说文本解析为角色、场景、集数。
 * 需在设置中配置 LLM API。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
  await queue.add(
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
}
