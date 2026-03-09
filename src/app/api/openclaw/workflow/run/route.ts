import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/auth";
import { createRun, startRunFirstStep } from "@/lib/workflow/service";
import { WORKFLOW_ID } from "@/lib/workflow/types";
import { isValidVisualStyleId } from "@/lib/workflow/visual-style";

// 验证 INTERNAL_TASK_TOKEN
function verifyInternalToken(req: Request): boolean {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  return token === process.env.INTERNAL_TASK_TOKEN;
}

// 最大输入长度限制
const MAX_NOVEL_TEXT_LENGTH = 100000; // 10万字符

// POST: 启动工作流
export async function POST(req: Request) {
  try {
    // 验证 token
    if (!verifyInternalToken(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const projectId = String(body.projectId ?? "").trim();
    const episodeId = String(body.episodeId ?? "").trim() || null;
    const novelText = String(body.novelText ?? "").trim();
    const visualStyleId = String(body.visualStyleId ?? "").trim() || null;
    const workflowId = String(body.workflowId ?? WORKFLOW_ID.NOVEL_TO_VIDEO).trim();

    // 验证必填字段
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    if (!novelText) {
      return NextResponse.json(
        { error: "novelText is required" },
        { status: 400 }
      );
    }

    // 验证输入长度
    if (novelText.length > MAX_NOVEL_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `novelText exceeds maximum length of ${MAX_NOVEL_TEXT_LENGTH} characters` },
        { status: 400 }
      );
    }

    // 获取或创建默认用户
    const user = await getOrCreateDefaultUser();

    // 验证项目存在且属于当前用户
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
      include: {
        novelPromotion: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // 验证剧集存在（如果提供了 episodeId）
    if (episodeId) {
      if (!project.novelPromotion) {
        return NextResponse.json(
          { error: "Project is not a novel promotion project" },
          { status: 400 }
        );
      }

      const episode = await prisma.novelPromotionEpisode.findFirst({
        where: {
          id: episodeId,
          novelPromotionProjectId: project.novelPromotion.id,
        },
      });

      if (!episode) {
        return NextResponse.json(
          { error: "Episode not found" },
          { status: 404 }
        );
      }
    }

    // 验证视觉风格
    const visualStyle =
      visualStyleId && isValidVisualStyleId(visualStyleId) ? visualStyleId : undefined;

    // 创建工作流运行
    const { run } = await createRun({
      userId: user.id,
      projectId,
      workflowId,
      input: {
        novelText,
        ...(visualStyle && { visualStyle }),
        ...(episodeId && { episodeId }),
      },
    });

    // 启动工作流第一步
    const task = await startRunFirstStep(run.id, {
      novelText,
      ...(visualStyle && { visualStyle }),
    });

    if (!task) {
      return NextResponse.json(
        { error: "Failed to start workflow" },
        { status: 500 }
      );
    }

    // 更新默认视觉风格（如果提供了）
    if (visualStyle && project.novelPromotion) {
      await prisma.novelPromotionProject.update({
        where: { id: project.novelPromotion.id },
        data: { defaultVisualStyle: visualStyle },
      });
    }

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      workflowId: run.workflowId,
      projectId: run.projectId,
      message: "Workflow started successfully. Will execute: analyze → storyboard → panels → voice → video",
      phases: [
        "analyze_novel",
        "story_to_script",
        "script_to_storyboard",
        "image_panels",
        "voice",
        "video",
      ],
    }, { status: 201 });
  } catch (error) {
    console.error("[openclaw/workflow/run POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start workflow" },
      { status: 500 }
    );
  }
}

// GET: 获取工作流信息
export async function GET(req: Request) {
  try {
    // 验证 token
    if (!verifyInternalToken(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      workflows: [
        {
          id: WORKFLOW_ID.NOVEL_TO_VIDEO,
          name: "Novel to Video",
          description: "Convert novel text to video through AI analysis, storyboarding, image generation, voice synthesis and video composition",
          phases: [
            {
              key: "analyze_novel",
              name: "剧本分析",
              description: "Analyze novel text and extract characters, locations, and episode structure",
            },
            {
              key: "story_to_script",
              name: "分场",
              description: "Convert story into script clips",
            },
            {
              key: "script_to_storyboard",
              name: "分镜",
              description: "Generate storyboard panels from script",
            },
            {
              key: "image_panels",
              name: "出图",
              description: "Generate images for storyboard panels",
            },
            {
              key: "voice",
              name: "配音",
              description: "Synthesize voice for dialogue lines",
            },
            {
              key: "video",
              name: "视频合成",
              description: "Compose final video from images and audio",
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("[openclaw/workflow/run GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get workflow info" },
      { status: 500 }
    );
  }
}
