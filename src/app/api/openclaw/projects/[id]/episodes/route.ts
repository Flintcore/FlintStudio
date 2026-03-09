import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/auth";

// 验证 INTERNAL_TASK_TOKEN
function verifyInternalToken(req: Request): boolean {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  return token === process.env.INTERNAL_TASK_TOKEN;
}

// GET: 列出项目下的所有剧集
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

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    // 获取或创建默认用户
    const user = await getOrCreateDefaultUser();

    // 验证项目存在且属于当前用户
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
      include: {
        novelPromotion: {
          select: { id: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (!project.novelPromotion) {
      return NextResponse.json(
        { error: "Project is not a novel promotion project" },
        { status: 400 }
      );
    }

    const npId = project.novelPromotion.id;

    // 查询剧集总数
    const total = await prisma.novelPromotionEpisode.count({
      where: { novelPromotionProjectId: npId },
    });

    // 查询剧集列表
    const episodes = await prisma.novelPromotionEpisode.findMany({
      where: { novelPromotionProjectId: npId },
      include: {
        clips: {
          select: {
            id: true,
            summary: true,
          },
          orderBy: { id: "asc" },
        },
        storyboards: {
          select: {
            id: true,
            panels: {
              select: { id: true },
            },
          },
        },
        voiceLines: {
          select: { id: true },
        },
        _count: {
          select: {
            shots: true,
          },
        },
      },
      orderBy: { episodeNumber: "asc" },
      skip,
      take: limit,
    });

    // 格式化响应
    const formattedEpisodes = episodes.map((episode: {
      id: string;
      episodeNumber: number;
      name: string;
      novelText: string | null;
      audioUrl: string | null;
      videoUrl: string | null;
      srtContent: string | null;
      createdAt: Date;
      updatedAt: Date;
      clips: { id: string; summary: string }[];
      storyboards: { id: string; panels: { id: string }[] }[];
      voiceLines: { id: string }[];
      _count: { shots: number };
    }) => ({
      id: episode.id,
      episodeNumber: episode.episodeNumber,
      name: episode.name,
      novelText: episode.novelText,
      audioUrl: episode.audioUrl,
      videoUrl: episode.videoUrl,
      srtContent: episode.srtContent,
      createdAt: episode.createdAt,
      updatedAt: episode.updatedAt,
      clipCount: episode.clips.length,
      clips: episode.clips.map((clip: { id: string; summary: string }) => ({
        id: clip.id,
        summary: clip.summary,
      })),
      storyboardCount: episode.storyboards.length,
      totalPanelCount: episode.storyboards.reduce(
        (sum: number, sb: { panels: { id: string }[] }) => sum + sb.panels.length,
        0
      ),
      voiceLineCount: episode.voiceLines.length,
      shotCount: episode._count.shots,
    }));

    return NextResponse.json({
      episodes: formattedEpisodes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[openclaw/projects/[id]/episodes GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list episodes" },
      { status: 500 }
    );
  }
}

// POST: 创建新剧集
export async function POST(
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

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const novelText = String(body.novelText ?? "").trim() || null;

    // 验证必填字段
    if (!name) {
      return NextResponse.json(
        { error: "Episode name is required" },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { error: "Episode name must be less than 200 characters" },
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
        novelPromotion: {
          select: { id: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (!project.novelPromotion) {
      return NextResponse.json(
        { error: "Project is not a novel promotion project" },
        { status: 400 }
      );
    }

    const npId = project.novelPromotion.id;

    // 获取当前最大的剧集编号
    const lastEpisode = await prisma.novelPromotionEpisode.findFirst({
      where: { novelPromotionProjectId: npId },
      orderBy: { episodeNumber: "desc" },
      select: { episodeNumber: true },
    });

    const nextEpisodeNumber = (lastEpisode?.episodeNumber ?? 0) + 1;

    // 创建新剧集
    const episode = await prisma.novelPromotionEpisode.create({
      data: {
        novelPromotionProjectId: npId,
        episodeNumber: nextEpisodeNumber,
        name,
        novelText,
      },
    });

    return NextResponse.json({
      id: episode.id,
      episodeNumber: episode.episodeNumber,
      name: episode.name,
      novelText: episode.novelText,
      createdAt: episode.createdAt,
      updatedAt: episode.updatedAt,
    }, { status: 201 });
  } catch (error) {
    console.error("[openclaw/projects/[id]/episodes POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create episode" },
      { status: 500 }
    );
  }
}
