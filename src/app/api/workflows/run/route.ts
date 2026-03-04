import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRun, startRunFirstStep } from "@/lib/workflow/service";
import { WORKFLOW_ID } from "@/lib/workflow/types";

// 最大输入长度限制
const MAX_NOVEL_TEXT_LENGTH = 100000; // 10万字符

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();

    const body = await req.json().catch(() => ({}));
    const projectId = String(body.projectId ?? "").trim();
    const novelText = String(body.novelText ?? body.input?.novelText ?? "").trim();

    if (!projectId || !novelText) {
      return NextResponse.json(
        { error: "请提供 projectId 和 novelText" },
        { status: 400 }
      );
    }

    // 验证输入长度
    if (novelText.length > MAX_NOVEL_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `小说文本长度超过限制 (${MAX_NOVEL_TEXT_LENGTH} 字符)` },
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
  } catch (e) {
    console.error("[workflows/run]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "启动工作流失败" },
      { status: 500 }
    );
  }
}

// 不允许 GET 请求
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
