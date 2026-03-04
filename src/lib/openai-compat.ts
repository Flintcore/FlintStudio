/**
 * OpenAI 兼容 API 路径规范（参考官方与 OpenRouter 等）
 * - Chat: POST /v1/chat/completions
 * - Images: POST /v1/images/generations
 * - Audio: POST /v1/audio/speech
 * 若 baseUrl 已包含 /v1，则不再重复拼接。
 */
export function normalizeOpenAIBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.includes("v1")) return trimmed;
    const path = u.pathname.replace(/\/+$/, "") || "";
    u.pathname = path ? `${path}/v1` : "v1";
    return u.toString();
  } catch {
    return trimmed;
  }
}

export const OPENAI_COMPAT_PATHS = {
  chatCompletions: "/chat/completions",
  imagesGenerations: "/images/generations",
  audioSpeech: "/audio/speech",
} as const;
