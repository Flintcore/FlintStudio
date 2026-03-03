import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRun, startRunFirstStep } from "@/lib/workflow/service";
import { WORKFLOW_ID } from "@/lib/workflow/types";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const projectId = String(body.projectId ?? "").trim();
  const novelText = String(body.novelText ?? body.input?.novelText ?? "").trim();

  if (!projectId || !novelText) {
    return NextResponse.json(
      { error: "请提供 projectId 和 novelText" },
      { status: 400 }
    );
  }

  const project = await import("@/lib/db").then((m) =>
    m.prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    })
  );
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const { run } = await createRun({
    userId: session.user.id,
    projectId,
    workflowId: WORKFLOW_ID.NOVEL_TO_VIDEO,
    input: { novelText },
  });

  const task = await startRunFirstStep(run.id, { novelText });
  if (!task) {
    return NextResponse.json(
      { error: "启动工作流失败" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    runId: run.id,
    status: run.status,
    message: "工作流已启动，将自动执行：剧本分析 → 分场 → 分镜 → …",
  });
}
