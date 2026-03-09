import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/auth";

// 验证 INTERNAL_TASK_TOKEN
function verifyInternalToken(req: Request): boolean {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  return token === process.env.INTERNAL_TASK_TOKEN;
}

// GET: 列出所有项目
export async function GET(req: Request) {
  try {
    // 验证 token
    if (!verifyInternalToken(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    // 获取或创建默认用户
    const user = await getOrCreateDefaultUser();

    // 查询项目总数
    const total = await prisma.project.count({
      where: { userId: user.id },
    });

    // 查询项目列表
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: {
        novelPromotion: {
          select: {
            id: true,
            artStyle: true,
            videoRatio: true,
            videoResolution: true,
            defaultVisualStyle: true,
            _count: {
              select: { episodes: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    });

    // 获取每个项目的运行次数
    const projectIds = projects.map((p: { id: string }) => p.id);
    const runCounts = await prisma.graphRun.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds } },
      _count: { id: true },
    });
    const runCountMap = new Map(runCounts.map((r) => [r.projectId, r._count.id]));

    // 格式化响应
    const formattedProjects = projects.map((project: {
      id: string;
      name: string;
      description: string | null;
      mode: string;
      createdAt: Date;
      updatedAt: Date;
      novelPromotion: {
        id: string;
        artStyle: string;
        videoRatio: string;
        videoResolution: string;
        defaultVisualStyle: string | null;
        _count: { episodes: number };
      } | null;
    }) => ({
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
            defaultVisualStyle: project.novelPromotion.defaultVisualStyle,
            episodeCount: project.novelPromotion._count.episodes,
          }
        : null,
      runCount: runCountMap.get(project.id) || 0,
    }));

    return NextResponse.json({
      projects: formattedProjects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[openclaw/projects GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list projects" },
      { status: 500 }
    );
  }
}

// POST: 创建新项目
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
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim() || null;
    const mode = String(body.mode ?? "novel-promotion").trim();

    // 验证必填字段
    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Project name must be less than 100 characters" },
        { status: 400 }
      );
    }

    // 获取或创建默认用户
    const user = await getOrCreateDefaultUser();

    // 创建项目
    const project = await prisma.project.create({
      data: {
        name,
        description,
        mode,
        userId: user.id,
      },
    });

    // 如果是小说推广模式，创建关联的 NovelPromotionProject
    if (mode === "novel-promotion") {
      await prisma.novelPromotionProject.create({
        data: {
          projectId: project.id,
          artStyle: String(body.artStyle ?? "american-comic").trim(),
          videoRatio: String(body.videoRatio ?? "9:16").trim(),
          videoResolution: String(body.videoResolution ?? "720p").trim(),
          imageResolution: String(body.imageResolution ?? "2K").trim(),
          defaultVisualStyle: body.defaultVisualStyle
            ? String(body.defaultVisualStyle).trim()
            : null,
        },
      });
    }

    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      mode: project.mode,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }, { status: 201 });
  } catch (error) {
    console.error("[openclaw/projects POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create project" },
      { status: 500 }
    );
  }
}
