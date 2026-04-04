import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getCurrentSession();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { novelPromotion: true },
  });
  if (!project?.novelPromotion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const npId = project.novelPromotion.id;

  const [episodeCount, panelCount, clipCount, voiceLineCount, completedEpisodes] = await Promise.all([
    prisma.novelPromotionEpisode.count({ where: { novelPromotionProjectId: npId } }),
    prisma.novelPromotionPanel.count({
      where: { storyboard: { episode: { novelPromotionProjectId: npId } } },
    }),
    prisma.novelPromotionClip.count({
      where: { episode: { novelPromotionProjectId: npId } },
    }),
    prisma.novelPromotionVoiceLine.count({
      where: { episode: { novelPromotionProjectId: npId } },
    }),
    prisma.novelPromotionEpisode.count({
      where: { novelPromotionProjectId: npId, videoUrl: { not: null } },
    }),
  ]);

  const imagesGenerated = await prisma.novelPromotionPanel.count({
    where: {
      storyboard: { episode: { novelPromotionProjectId: npId } },
      imageUrl: { not: null },
    },
  });

  const audioGenerated = await prisma.novelPromotionVoiceLine.count({
    where: {
      episode: { novelPromotionProjectId: npId },
      audioUrl: { not: null },
    },
  });

  // 计算总耗时：取第一个 run 的 queuedAt 到最后一个完成的 step
  const firstRun = await prisma.graphRun.findFirst({
    where: { projectId },
    orderBy: { queuedAt: "asc" },
    select: { queuedAt: true },
  });
  const lastStep = await prisma.graphStep.findFirst({
    where: { run: { projectId }, status: "completed" },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });

  let runtimeMs: number | null = null;
  if (firstRun?.queuedAt && lastStep?.finishedAt) {
    runtimeMs = lastStep.finishedAt.getTime() - firstRun.queuedAt.getTime();
  }

  return NextResponse.json({
    episodeCount,
    completedEpisodes,
    panelCount,
    imagesGenerated,
    clipCount,
    voiceLineCount,
    audioGenerated,
    runtimeMs,
  });
}
