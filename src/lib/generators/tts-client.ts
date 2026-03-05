import { getUserApiConfig } from "@/lib/api-config";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { normalizeOpenAIBaseUrl, OPENAI_COMPAT_PATHS } from "@/lib/openai-compat";
import { withRetry } from "@/lib/utils/retry";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const VOICE_DIR = path.join(DATA_DIR, "voice");

// TTS 专用重试配置
const TTS_RETRY_OPTIONS = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  timeout: 60000,
  retryableErrors: [
    "rate limit",
    "timeout",
    "429",
    "503",
    "504",
    "ECONNRESET",
  ],
};

/** 调用用户配置的 TTS API（OpenAI 兼容 /v1/audio/speech），生成音频并保存到 data/voice，返回相对 URL */
export async function generateSpeech(opts: {
  userId: string;
  text: string;
  voice?: string;
  voiceLineId: string;
}): Promise<{ audioUrl: string }> {
  const config = await getUserApiConfig(opts.userId, "voice");
  if (!config?.baseUrl || !config?.apiKey) {
    throw new Error("请先在设置中配置语音合成 Base URL 和 API Key");
  }

  const base = normalizeOpenAIBaseUrl(config.baseUrl);

  return withRetry(
    async () => {
      const res = await fetch(`${base}${OPENAI_COMPAT_PATHS.audioSpeech}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: opts.voice || "alloy",
          input: opts.text.slice(0, 4096),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`TTS 请求失败: ${res.status} ${err}`);
      }

      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(VOICE_DIR, { recursive: true });
      const filename = `${opts.voiceLineId}.mp3`;
      const filePath = path.join(VOICE_DIR, filename);
      await writeFile(filePath, buf);

      return {
        audioUrl: `/api/media/voice/${filename}`,
      };
    },
    {
      ...TTS_RETRY_OPTIONS,
      onRetry: (error, attempt) => {
        console.warn(
          `[TTS] 语音 ${opts.voiceLineId} 生成失败，第 ${attempt}/${TTS_RETRY_OPTIONS.maxAttempts} 次重试，错误: ${error.message}`
        );
      },
    }
  );
}
