import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/auth";
import {
  getCustomProvidersPayload,
  saveCustomProvidersPayload,
  type CustomProvider,
  type ApiType,
} from "@/lib/api-config";

// 验证 INTERNAL_TASK_TOKEN
function verifyInternalToken(req: Request): boolean {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  return token === process.env.INTERNAL_TASK_TOKEN;
}

// 脱敏 API Key：只显示前4位和后4位，中间用 *** 替代
function maskApiKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 12) return "***";
  return `${key.slice(0, 4)}***${key.slice(-4)}`;
}

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

// GET: 获取当前 API 配置（脱敏）
export async function GET(req: Request) {
  try {
    // 验证 token
    if (!verifyInternalToken(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 获取或创建默认用户
    const user = await getOrCreateDefaultUser();

    // 获取自定义提供商配置
    const payload = await getCustomProvidersPayload(user.id);

    // 获取用户偏好设置
    const prefs = await prisma.userPreference.findUnique({
      where: { userId: user.id },
    });

    // 脱敏处理自定义提供商
    const maskedProviders =
      payload.providers?.map((provider: CustomProvider) => ({
        ...provider,
        apiKey: maskApiKey(provider.apiKey),
      })) ?? [];

    return NextResponse.json({
      llm: {
        baseUrl: prefs?.llmBaseUrl ?? "https://openrouter.ai/api/v1",
        apiKey: maskApiKey(prefs?.llmApiKey),
        analysisModel: prefs?.analysisModel ?? "",
        storyboardModel: prefs?.storyboardModel ?? "",
      },
      image: {
        baseUrl: prefs?.imageBaseUrl ?? "",
        apiKey: maskApiKey(prefs?.imageApiKey),
      },
      voice: {
        baseUrl: prefs?.ttsBaseUrl ?? "",
        apiKey: maskApiKey(prefs?.ttsApiKey),
      },
      video: {
        baseUrl: prefs?.videoBaseUrl ?? "",
        apiKey: maskApiKey(prefs?.videoApiKey),
        videoModel: prefs?.videoModel ?? "",
      },
      providers: maskedProviders,
      defaults: payload.defaults ?? {},
      updatedAt: prefs?.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[openclaw/config GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get config" },
      { status: 500 }
    );
  }
}

// POST: 更新 API 配置
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

    // 获取或创建默认用户
    const user = await getOrCreateDefaultUser();

    // 验证 URL 格式
    const urlsToValidate = [
      { key: "llmBaseUrl", value: body.llm?.baseUrl },
      { key: "imageBaseUrl", value: body.image?.baseUrl },
      { key: "ttsBaseUrl", value: body.voice?.baseUrl },
      { key: "videoBaseUrl", value: body.video?.baseUrl },
    ];

    for (const { key, value } of urlsToValidate) {
      if (value && !isValidUrl(value)) {
        return NextResponse.json(
          { error: `Invalid URL: ${key}` },
          { status: 400 }
        );
      }
    }

    // 验证 API Key 长度
    const keysToValidate = [
      { key: "llmApiKey", value: body.llm?.apiKey },
      { key: "imageApiKey", value: body.image?.apiKey },
      { key: "ttsApiKey", value: body.voice?.apiKey },
      { key: "videoApiKey", value: body.video?.apiKey },
    ];

    for (const { key, value } of keysToValidate) {
      if (value && !isValidApiKey(value)) {
        return NextResponse.json(
          { error: `API Key too short: ${key} (minimum 8 characters)` },
          { status: 400 }
        );
      }
    }

    // 更新用户偏好设置
    const updateData: Record<string, unknown> = {};

    if (body.llm) {
      if (body.llm.baseUrl !== undefined) updateData.llmBaseUrl = body.llm.baseUrl;
      if (body.llm.apiKey !== undefined) updateData.llmApiKey = body.llm.apiKey;
      if (body.llm.analysisModel !== undefined)
        updateData.analysisModel = body.llm.analysisModel;
      if (body.llm.storyboardModel !== undefined)
        updateData.storyboardModel = body.llm.storyboardModel;
    }

    if (body.image) {
      if (body.image.baseUrl !== undefined) updateData.imageBaseUrl = body.image.baseUrl;
      if (body.image.apiKey !== undefined) updateData.imageApiKey = body.image.apiKey;
    }

    if (body.voice) {
      if (body.voice.baseUrl !== undefined) updateData.ttsBaseUrl = body.voice.baseUrl;
      if (body.voice.apiKey !== undefined) updateData.ttsApiKey = body.voice.apiKey;
    }

    if (body.video) {
      if (body.video.baseUrl !== undefined) updateData.videoBaseUrl = body.video.baseUrl;
      if (body.video.apiKey !== undefined) updateData.videoApiKey = body.video.apiKey;
      if (body.video.videoModel !== undefined) updateData.videoModel = body.video.videoModel;
    }

    // 执行更新
    await prisma.userPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        llmBaseUrl: "https://openrouter.ai/api/v1",
        ...updateData,
      },
      update: updateData,
    });

    // 更新自定义提供商（如果提供）
    if (body.providers !== undefined && Array.isArray(body.providers)) {
      const providers: CustomProvider[] = body.providers
        .filter((p: unknown) => p && typeof p === "object")
        .map((p: Record<string, unknown>, i: number) => ({
          id:
            String(p.id ?? `p-${i}-${Date.now()}`).trim() ||
            `p-${i}-${Date.now()}`,
          name: String(p.name ?? "").trim() || "未命名",
          baseUrl: String(p.baseUrl ?? "").trim(),
          apiKey: String(p.apiKey ?? "").trim(),
          model: p.model != null ? String(p.model).trim() || undefined : undefined,
          type: ["llm", "image", "voice", "video"].includes(String(p.type))
            ? (p.type as ApiType)
            : "llm",
        }));
      const defaults =
        body.defaults && typeof body.defaults === "object"
          ? (body.defaults as Partial<Record<ApiType, string>>)
          : {};
      await saveCustomProvidersPayload(user.id, { providers, defaults });
    }

    // 获取更新后的配置（脱敏）
    const updatedPrefs = await prisma.userPreference.findUnique({
      where: { userId: user.id },
    });
    const updatedPayload = await getCustomProvidersPayload(user.id);

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
      config: {
        llm: {
          baseUrl: updatedPrefs?.llmBaseUrl ?? "https://openrouter.ai/api/v1",
          apiKey: maskApiKey(updatedPrefs?.llmApiKey),
          analysisModel: updatedPrefs?.analysisModel ?? "",
          storyboardModel: updatedPrefs?.storyboardModel ?? "",
        },
        image: {
          baseUrl: updatedPrefs?.imageBaseUrl ?? "",
          apiKey: maskApiKey(updatedPrefs?.imageApiKey),
        },
        voice: {
          baseUrl: updatedPrefs?.ttsBaseUrl ?? "",
          apiKey: maskApiKey(updatedPrefs?.ttsApiKey),
        },
        video: {
          baseUrl: updatedPrefs?.videoBaseUrl ?? "",
          apiKey: maskApiKey(updatedPrefs?.videoApiKey),
          videoModel: updatedPrefs?.videoModel ?? "",
        },
        providers:
          updatedPayload.providers?.map((p: CustomProvider) => ({
            ...p,
            apiKey: maskApiKey(p.apiKey),
          })) ?? [],
        defaults: updatedPayload.defaults ?? {},
      },
    });
  } catch (error) {
    console.error("[openclaw/config POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update config" },
      { status: 500 }
    );
  }
}
