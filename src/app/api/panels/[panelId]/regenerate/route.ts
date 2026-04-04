import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateImage } from "@/lib/generators/image-client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ panelId: string }> }
) {
  const session = await getCurrentSession();
  const { panelId } = await params;

  // 找到 panel 并验证归属
  const panel = await prisma.novelPromotionPanel.findFirst({
    where: { id: panelId },
    include: {
      storyboard: {
        include: {
          episode: {
            include: {
              novelPromotionProject: {
                include: { project: { select: { userId: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!panel || panel.storyboard.episode.novelPromotionProject.project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const prompt = panel.imagePrompt?.trim() || panel.description?.trim() || "cinematic scene";

  try {
    const result = await generateImage({
      userId: session.user.id,
      prompt: prompt.slice(0, 4000),
      size: "1024x1024",
    });

    if (!result.url) {
      return NextResponse.json({ error: "图像生成失败" }, { status: 500 });
    }

    await prisma.novelPromotionPanel.update({
      where: { id: panelId },
      data: { imageUrl: result.url },
    });

    return NextResponse.json({ success: true, imageUrl: result.url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "生成失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
