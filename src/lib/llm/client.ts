import { getUserApiConfig } from "@/lib/api-config";

/** 调用用户配置的 LLM（OpenAI 兼容），返回 JSON 解析结果 */
export async function llmJson<T = Record<string, unknown>>(
  userId: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; temperature?: number }
): Promise<T> {
  const config = await getUserApiConfig(userId, "llm");
  if (!config?.baseUrl || !config?.apiKey) {
    throw new Error("请先在设置中配置 LLM Base URL 和 API Key");
  }

  const model = options?.model ?? "openai/gpt-4o-mini";
  const temperature = options?.temperature ?? 0.3;

  const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM 请求失败: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 未返回内容");

  return JSON.parse(content) as T;
}
