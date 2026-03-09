import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/auth";

// 验证 INTERNAL_TASK_TOKEN
function verifyInternalToken(req: Request): boolean {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  return token === process.env.INTERNAL_TASK_TOKEN;
}

// GET: 获取项目详情
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证 token
    if (!verifyInternalToken(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const projectId = String(id).trim();

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // 获取或创建默认用户
    const user = await getOrCreateDefaultUser();

    // 查询项目详情
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
      include: {
        novelPromotion: {
          include: {
            characters: {
              select: {
                id: true,
                name: true,
                aliases: true,
                voiceId: true,
              },
            },
            locations: {
              select: {
                id: true,
                name: true,
                summary: true,
              },
            },
            episodes: {
              orderBy: { episodeNumber: "asc" },
              select: {
                id: true,
                episodeNumber: true,
                name: true,
                audioUrl: true,
                videoUrl: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                  select: {
                    clips: true,
                    storyboards: true,
                    voiceLines: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // 单独查询 GraphRun
    const graphRuns = await prisma.graphRun.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        workflowId: true,
        status: true,
        currentPhase: true,
        createdAt: true,
        finishedAt: true,
      },
    });

    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      mode: project.mode,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      novelPromotion: project.novelPromotion
        ? {
            id: project.novelPromotion.id,
            artStyle: project.novelPromotion.artStyle,
            videoRatio: project.novelPromotion.videoRatio,
            videoResolution: project.novelPromotion.videoResolution,
            imageResolution: project.novelPromotion.imageResolution,
            defaultVisualStyle: project.novelPromotion.defaultVisualStyle,
            characterCount: project.novelPromotion.characters.length,
            locationCount: project.novelPromotion.locations.length,
            episodeCount: project.novelPromotion.episodes.length,
            characters: project.novelPromotion.characters,
            locations: project.novelPromotion.locations,
            episodes: project.novelPromotion.episodes.map((ep: {
        id: string;
        episodeNumber: number;
        name: string;
        audioUrl: string | null;
        videoUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
        _count: { clips: number; storyboards: number; voiceLines: number };
      }) => ({
              id: ep.id,
              episodeNumber: ep.episodeNumber,
              name: ep.name,
              audioUrl: ep.audioUrl,
              videoUrl: ep.videoUrl,
              createdAt: ep.createdAt,
              updatedAt: ep.updatedAt,
              clipCount: ep._count.clips,
              storyboardCount: ep._count.storyboards,
              voiceLineCount: ep._count.voiceLines,
            })),
          }
        : null,
      recentRuns: graphRuns,
    });
  } catch (error) {
    console.error("[openclaw/projects/[id] GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get project" },
      { status: 500 }
    );
  }
}

// DELETE: 删除项目
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证 token
    if (!verifyInternalToken(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const projectId = String(id).trim();

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // 获取或创建默认用户
    const user = await getOrCreateDefaultUser();

    // 检查项目是否存在
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // 检查是否有正在运行的任务
    const activeRuns = await prisma.graphRun.count({
      where: {
        projectId,
        status: { in: ["queued", "running"] },
      },
    });

    if (activeRuns > 0) {
      return NextResponse.json(
        { error: "Cannot delete project with active workflow runs" },
        { status: 409 }
      );
    }

    // 删除项目（级联删除关联数据）
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({
      success: true,
      message: "Project deleted successfully",
      deletedId: projectId,
    });
  } catch (error) {
    console.error("[openclaw/projects/[id] DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete project" },
      { status: 500 }
    );
  }
}
