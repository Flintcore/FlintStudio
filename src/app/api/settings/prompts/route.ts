import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface CustomPrompts {
  analyzeNovelSystem?: string;
  storyToScriptSystem?: string;
  scriptToStoryboardSystem?: string;
  voiceExtractSystem?: string;
}

function parseCustomPrompts(raw: string | null | undefined): CustomPrompts {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as CustomPrompts;
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const session = await getCurrentSession();
    const prefs = await prisma.userPreference.findUnique({
      where: { userId: session.user.id },
      select: { customPrompts: true },
    });

    const customPrompts = parseCustomPrompts(prefs?.customPrompts);
    return NextResponse.json({ prompts: customPrompts });
  } catch (e) {
    console.error("[api/settings/prompts GET]", e);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    const body = await req.json().catch(() => ({}));
    const userId = session.user.id;

    const customPrompts: CustomPrompts = {
      analyzeNovelSystem: body.analyzeNovelSystem?.trim() || undefined,
      storyToScriptSystem: body.storyToScriptSystem?.trim() || undefined,
      scriptToStoryboardSystem: body.scriptToStoryboardSystem?.trim() || undefined,
      voiceExtractSystem: body.voiceExtractSystem?.trim() || undefined,
    };

    // 过滤掉空值
    const cleanedPrompts: CustomPrompts = Object.fromEntries(
      Object.entries(customPrompts).filter(([, v]) => v && v.length > 0)
    ) as CustomPrompts;

    const raw = Object.keys(cleanedPrompts).length > 0 ? JSON.stringify(cleanedPrompts) : null;

    await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        customPrompts: raw,
      },
      update: {
        customPrompts: raw,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/settings/prompts POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存失败" },
      { status: 500 }
    );
  }
}
