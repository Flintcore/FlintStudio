import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const session = await getCurrentSession();
  const { episodeId } = await params;

  const episode = await prisma.novelPromotionEpisode.findFirst({
    where: { id: episodeId },
    select: {
      id: true,
      videoUrl: true,
      audioUrl: true,
      novelPromotionProject: {
        select: { project: { select: { userId: true } } },
      },
    },
  });

  if (!episode || episode.novelPromotionProject.project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ id: episode.id, videoUrl: episode.videoUrl, audioUrl: episode.audioUrl });
}
