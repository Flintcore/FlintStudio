import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRun, startRunFirstStep } from "@/lib/workflow/service";
import { WORKFLOW_ID } from "@/lib/workflow/types";
import { isValidVisualStyleId } from "@/lib/workflow/visual-style";
import { validateObject, isValidUUID } from "@/lib/validation";

// 最大输入长度限制
const MAX_NOVEL_TEXT_LENGTH = 100000; // 10万字符

// 工作流运行请求验证 Schema
const workflowRunSchema = {
  projectId: {
    required: true,
    type: "string" as const,
    custom: (value: unknown) => {
      if (!isValidUUID(String(value))) {
        return "项目 ID 必须是有效的 UUID";
      }
      return true;
    },
  },
  novelText: {
    required: true,
    type: "string" as const,
    minLength: 10,
    maxLength: MAX_NOVEL_TEXT_LENGTH,
  },
  visualStyle: {
    type: "string" as const,
    maxLength: 50,
  },
};

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();

    const body = await req.json().catch(() => null);
    if (body == null) {
      return NextResponse.json(
        { error: "请求体不是有效的 JSON" },
        { status: 400 }
      );
    }

    // 验证输入
    const validation = validateObject(body, workflowRunSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: "验证失败", details: validation.errors },
        { status: 400 }
      );
    }

    const data = validation.data as { projectId: string; novelText: string; visualStyle?: string };
    const { projectId, novelText, visualStyle: inputVisualStyle } = data;
    const visualStyle = inputVisualStyle?.trim() || undefined;

    const { prisma } = await import("@/lib/db");
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
      include: { novelPromotion: true },
    });
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const validVisualStyle =
      visualStyle && isValidVisualStyleId(visualStyle) ? visualStyle : undefined;

    const { run } = await createRun({
      userId: session.user.id,
      projectId,
      workflowId: WORKFLOW_ID.NOVEL_TO_VIDEO,
      input: { novelText, ...(validVisualStyle && { visualStyle: validVisualStyle }) },
    });

    const task = await startRunFirstStep(run.id, {
      novelText,
      ...(validVisualStyle && { visualStyle: validVisualStyle }),
    });
    if (!task) {
      return NextResponse.json(
        { error: "启动工作流失败" },
        { status: 500 }
      );
    }

    if (validVisualStyle && project.novelPromotion) {
      const novelPromotionId = project.novelPromotion.id;
      await prisma.novelPromotionProject.update({
        where: { id: novelPromotionId },
        data: { defaultVisualStyle: validVisualStyle },
      });
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
