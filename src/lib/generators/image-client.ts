import { getUserApiConfig } from "@/lib/api-config";
import { normalizeOpenAIBaseUrl, OPENAI_COMPAT_PATHS } from "@/lib/openai-compat";
import { withRetry, IMAGE_RETRY_OPTIONS } from "@/lib/utils/retry";

/** 检查是否为本地端点（不需要 API Key） */
function isLocalEndpoint(baseUrl: string): boolean {
  const lower = baseUrl.toLowerCase();
  return lower.includes("localhost") || lower.includes("127.0.0.1");
}

/** 调用用户配置的图像 API（OpenAI 兼容 /v1/images/generations），返回图片 URL 或 base64 */
export async function generateImage(opts: {
  userId: string;
  prompt: string;
  size?: string;
  model?: string;
}): Promise<{ url?: string; b64?: string }> {
  const config = await getUserApiConfig(opts.userId, "image");
  if (!config?.baseUrl) {
    throw new Error("请先在设置中配置图像生成 Base URL 和 API Key");
  }
  // 本地端点不需要 API Key
  const apiKeyRequired = !isLocalEndpoint(config.baseUrl);
  if (apiKeyRequired && !config.apiKey) {
    throw new Error("请先在设置中配置图像生成 Base URL 和 API Key");
  }

  const base = normalizeOpenAIBaseUrl(config.baseUrl);
  const model = opts.model ?? config.model ?? "dall-e-3";

  return withRetry(
    async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.apiKey) {
        headers.Authorization = `Bearer ${config.apiKey}`;
      }
      const res = await fetch(`${base}${OPENAI_COMPAT_PATHS.imagesGenerations}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          prompt: opts.prompt.slice(0, 4000),
          n: 1,
          size: opts.size ?? "1024x1024",
          response_format: "url",
          quality: "standard",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`图像生成失败: ${res.status} ${err}`);
      }

      const data = (await res.json()) as {
        data?: Array<{ url?: string; b64_json?: string }>;
      };
      const first = data.data?.[0];
      if (!first) throw new Error("图像 API 未返回图片");
      if (first.url) return { url: first.url };
      if (first.b64_json) return { b64: first.b64_json };
      throw new Error("图像 API 返回格式异常");
    },
    {
      ...IMAGE_RETRY_OPTIONS,
      onRetry: (error, attempt) => {
        console.warn(
          `[Image] 用户 ${opts.userId} 图像生成失败，第 ${attempt}/${IMAGE_RETRY_OPTIONS.maxAttempts} 次重试，错误: ${error.message}`
        );
      },
    }
  );
}
