import { getUserApiConfig } from "@/lib/api-config";

/** 调用用户配置的图像 API（OpenAI 兼容 /v1/images/generations），返回图片 URL 或 base64 */
export async function generateImage(opts: {
  userId: string;
  prompt: string;
  size?: string;
}): Promise<{ url?: string; b64?: string }> {
  const config = await getUserApiConfig(opts.userId, "image");
  if (!config?.baseUrl || !config?.apiKey) {
    throw new Error("请先在设置中配置图像生成 Base URL 和 API Key");
  }

  const base = config.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
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
}
