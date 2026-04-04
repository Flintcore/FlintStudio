/**
 * API 连通性测试
 * POST: 测试 LLM / Image / TTS 的连接是否正常
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";

export async function POST(req: Request) {
  await getCurrentSession(); // 验证登录

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, baseUrl, apiKey, model } = body as {
    type: "llm" | "image" | "tts";
    baseUrl: string;
    apiKey?: string;
    model?: string;
  };

  if (!type || !baseUrl) {
    return NextResponse.json({ error: "Missing type or baseUrl" }, { status: 400 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const start = Date.now();

  try {
    if (type === "llm") {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return NextResponse.json({
          success: false,
          message: `HTTP ${res.status}: ${text.slice(0, 200)}`,
          latencyMs,
        });
      }
      const data = await res.json();
      const modelUsed = data?.model ?? model ?? "unknown";
      return NextResponse.json({
        success: true,
        message: `连接成功 (模型: ${modelUsed})`,
        latencyMs,
      });
    }

    if (type === "image") {
      const res = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model || "dall-e-3",
          prompt: "a red circle",
          n: 1,
          size: "256x256",
        }),
        signal: AbortSignal.timeout(30000),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return NextResponse.json({
          success: false,
          message: `HTTP ${res.status}: ${text.slice(0, 200)}`,
          latencyMs,
        });
      }
      return NextResponse.json({
        success: true,
        message: "图像 API 连接成功",
        latencyMs,
      });
    }

    if (type === "tts") {
      const res = await fetch(`${baseUrl}/audio/speech`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model || "tts-1",
          input: "Hello",
          voice: "alloy",
        }),
        signal: AbortSignal.timeout(20000),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return NextResponse.json({
          success: false,
          message: `HTTP ${res.status}: ${text.slice(0, 200)}`,
          latencyMs,
        });
      }
      return NextResponse.json({
        success: true,
        message: "TTS API 连接成功",
        latencyMs,
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    const latencyMs = Date.now() - start;
    const msg = error instanceof Error ? error.message : "连接失败";
    return NextResponse.json({ success: false, message: msg, latencyMs });
  }
}
