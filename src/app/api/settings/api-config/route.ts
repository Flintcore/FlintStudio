import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const userId = session.user.id;

  await prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      llmBaseUrl: body.llmBaseUrl ?? undefined,
      llmApiKey: body.llmApiKey ?? undefined,
      imageBaseUrl: body.imageBaseUrl ?? undefined,
      imageApiKey: body.imageApiKey ?? undefined,
      ttsBaseUrl: body.ttsBaseUrl ?? undefined,
      ttsApiKey: body.ttsApiKey ?? undefined,
      videoBaseUrl: body.videoBaseUrl ?? undefined,
      videoApiKey: body.videoApiKey ?? undefined,
    },
    update: {
      llmBaseUrl: body.llmBaseUrl ?? undefined,
      llmApiKey: body.llmApiKey ?? undefined,
      imageBaseUrl: body.imageBaseUrl ?? undefined,
      imageApiKey: body.imageApiKey ?? undefined,
      ttsBaseUrl: body.ttsBaseUrl ?? undefined,
      ttsApiKey: body.ttsApiKey ?? undefined,
      videoBaseUrl: body.videoBaseUrl ?? undefined,
      videoApiKey: body.videoApiKey ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
