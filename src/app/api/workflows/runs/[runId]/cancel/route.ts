import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelRunJobs } from "@/lib/task/queues";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await getCurrentSession();
  const { runId } = await params;

  const run = await prisma.graphRun.findUnique({ where: { id: runId } });
  if (!run || run.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (run.status === "canceled" || run.status === "completed") {
    return NextResponse.json({ error: "运行已结束，无法取消" }, { status: 400 });
  }

  // 更新 DB 状态
  await prisma.graphRun.update({
    where: { id: runId },
    data: { status: "canceled", finishedAt: new Date() },
  });
  await prisma.task.updateMany({
    where: { runId, status: { in: ["queued", "running"] } },
    data: { status: "canceled" },
  });

  // 从 BullMQ 队列中移除相关 Job
  await cancelRunJobs(runId);

  return NextResponse.json({ success: true });
}
