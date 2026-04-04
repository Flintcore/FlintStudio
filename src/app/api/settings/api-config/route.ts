import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCustomProvidersPayload, saveCustomProvidersPayload, type CustomProvider, type ApiType } from "@/lib/api-config";

// 验证 URL 格式
function isValidUrl(url: string): boolean {
  if (!url) return true; // 空值允许
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// 验证 API Key 格式（基本长度检查）
function isValidApiKey(key: string): boolean {
  if (!key) return true; // 空值允许
  return key.length >= 8; // 至少 8 个字符
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    const body = await req.json().catch(() => ({}));
    const userId = session.user.id;

    // 验证 URL 格式
    const urlsToValidate = [
      { key: "llmBaseUrl", value: body.llmBaseUrl },
      { key: "imageBaseUrl", value: body.imageBaseUrl },
      { key: "ttsBaseUrl", value: body.ttsBaseUrl },
      { key: "videoBaseUrl", value: body.videoBaseUrl },
    ];

    for (const { key, value } of urlsToValidate) {
      if (value && !isValidUrl(value)) {
        return NextResponse.json(
          { error: `无效的 URL: ${key}` },
          { status: 400 }
        );
      }
    }

    // 验证 API Key 长度
    const keysToValidate = [
      { key: "llmApiKey", value: body.llmApiKey },
      { key: "imageApiKey", value: body.imageApiKey },
      { key: "ttsApiKey", value: body.ttsApiKey },
      { key: "videoApiKey", value: body.videoApiKey },
    ];

    for (const { key, value } of keysToValidate) {
      if (value && !isValidApiKey(value)) {
        return NextResponse.json(
          { error: `API Key 太短: ${key} (至少需要 8 个字符)` },
          { status: 400 }
        );
      }
    }

    type TokenField = { internalTaskToken?: string | null };
    const tokenPatch: TokenField = {};
    if (Object.prototype.hasOwnProperty.call(body, "internalTaskToken")) {
      const v = body.internalTaskToken;
      if (v === null || v === "") {
        tokenPatch.internalTaskToken = null;
      } else if (typeof v === "string" && v.trim()) {
        tokenPatch.internalTaskToken = v.trim();
      }
    }

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
        analysisModel: body.analysisModel ?? undefined,
        storyboardModel: body.storyboardModel ?? undefined,
        videoModel: body.videoModel ?? undefined,
        ...tokenPatch,
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
        analysisModel: body.analysisModel ?? undefined,
        storyboardModel: body.storyboardModel ?? undefined,
        videoModel: body.videoModel ?? undefined,
        ...tokenPatch,
      },
    });

    if (body.providers !== undefined && Array.isArray(body.providers)) {
      const providers: CustomProvider[] = body.providers
        .filter((p: unknown) => p && typeof p === "object")
        .map((p: Record<string, unknown>, i: number) => ({
          id: String(p.id ?? `p-${i}-${Date.now()}`).trim() || `p-${i}-${Date.now()}`,
          name: String(p.name ?? "").trim() || "未命名",
          baseUrl: String(p.baseUrl ?? "").trim(),
          apiKey: String(p.apiKey ?? "").trim(),
          model: p.model != null ? String(p.model).trim() || undefined : undefined,
          type: ["llm", "image", "voice", "video"].includes(String(p.type)) ? (p.type as ApiType) : "llm",
        }));
      const defaults =
        body.defaults && typeof body.defaults === "object"
          ? (body.defaults as Partial<Record<ApiType, string>>)
          : {};
      await saveCustomProvidersPayload(userId, { providers, defaults });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/settings/api-config]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存失败" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getCurrentSession();
    const payload = await getCustomProvidersPayload(session.user.id);
    const prefs = await prisma.userPreference.findUnique({
      where: { userId: session.user.id },
    });
    return NextResponse.json({
      llmBaseUrl: prefs?.llmBaseUrl ?? "https://openrouter.ai/api/v1",
      llmApiKey: prefs?.llmApiKey ?? "",
      imageBaseUrl: prefs?.imageBaseUrl ?? "",
      imageApiKey: prefs?.imageApiKey ?? "",
      ttsBaseUrl: prefs?.ttsBaseUrl ?? "",
      ttsApiKey: prefs?.ttsApiKey ?? "",
      videoBaseUrl: prefs?.videoBaseUrl ?? "",
      videoApiKey: prefs?.videoApiKey ?? "",
      analysisModel: prefs?.analysisModel ?? "",
      storyboardModel: prefs?.storyboardModel ?? "",
      videoModel: prefs?.videoModel ?? "",
      /** 是否已在数据库保存 Worker 令牌（不回传明文） */
      hasWorkerInternalToken: !!(prefs?.internalTaskToken && String(prefs.internalTaskToken).trim()),
      providers: payload.providers,
      defaults: payload.defaults ?? {},
    });
  } catch (e) {
    console.error("[api/settings/api-config GET]", e);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}
