import { getUserApiConfig } from "@/lib/api-config";
import { normalizeOpenAIBaseUrl, OPENAI_COMPAT_PATHS } from "@/lib/openai-compat";
import { withRetry, LLM_RETRY_OPTIONS } from "@/lib/utils/retry";

/**
 * 健壮 JSON 提取器。
 * 部分模型（DeepSeek、Qwen、Ollama 等）不支持 response_format=json_object，
 * 会在 JSON 外层包裹 ```json ... ``` 代码块，或在前后添加说明文字。
 * 三级尝试：① 直接解析 ② 提取 json 代码块 ③ 提取第一个完整 JSON 对象/数组
 */
function extractJson<T>(content: string): T {
  // 1. 直接解析
  try {
    return JSON.parse(content) as T;
  } catch {
    // 继续尝试
  }

  // 2. 提取 ```json ... ``` 或 ``` ... ``` 代码块
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // 继续尝试
    }
  }

  // 3. 提取第一个完整 JSON 对象 {} 或数组 []
  // 找到第一个 { 或 [，然后用括号配对找到结尾
  const firstBrace = content.search(/[{[]/);
  if (firstBrace !== -1) {
    const openChar = content[firstBrace];
    const closeChar = openChar === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < content.length; i++) {
      const ch = content[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\" && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(content.slice(firstBrace, i + 1)) as T;
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error(`LLM 返回内容无法解析为 JSON。原始内容（前500字）：${content.slice(0, 500)}`);
}

/** 检查是否为本地端点（不需要 API Key） */
function isLocalEndpoint(baseUrl: string): boolean {
  const lower = baseUrl.toLowerCase();
  return lower.includes("localhost") || lower.includes("127.0.0.1");
}

/** 调用用户配置的 LLM（OpenAI 兼容 /v1/chat/completions），返回 JSON 解析结果 */
export async function llmJson<T = Record<string, unknown>>(
  userId: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; temperature?: number }
): Promise<T> {
  const config = await getUserApiConfig(userId, "llm");
  if (!config?.baseUrl) {
    throw new Error("请先在设置中配置 LLM Base URL 和 API Key");
  }
  // 本地端点不需要 API Key
  const apiKeyRequired = !isLocalEndpoint(config.baseUrl);
  if (apiKeyRequired && !config.apiKey) {
    throw new Error("请先在设置中配置 LLM Base URL 和 API Key");
  }

  const base = normalizeOpenAIBaseUrl(config.baseUrl);
  const model = options?.model ?? config.model ?? "gpt-4o-mini";
  const temperature = options?.temperature ?? 0.3;

  // 使用重试机制包装请求
  return withRetry(
    async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.apiKey) {
        headers.Authorization = `Bearer ${config.apiKey}`;
      }
      const res = await fetch(`${base}${OPENAI_COMPAT_PATHS.chatCompletions}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          // response_format: { type: "json_object" }, // 移除：DeepSeek/Qwen/Ollama 等不支持，已在 extractJson 做兼容
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`LLM 请求失败: ${res.status} ${err}`);
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("LLM 未返回内容");

      return extractJson<T>(content);
    },
    {
      ...LLM_RETRY_OPTIONS,
      onRetry: (error, attempt) => {
        console.warn(
          `[LLM] 用户 ${userId} 请求失败，第 ${attempt}/${LLM_RETRY_OPTIONS.maxAttempts} 次重试，错误: ${error.message}`
        );
      },
    }
  );
}

/**
 * 非 JSON 格式的 LLM 调用（用于普通对话）
 */
export async function llmChat(
  userId: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  const config = await getUserApiConfig(userId, "llm");
  if (!config?.baseUrl) {
    throw new Error("请先在设置中配置 LLM Base URL 和 API Key");
  }
  // 本地端点不需要 API Key
  const apiKeyRequired = !isLocalEndpoint(config.baseUrl);
  if (apiKeyRequired && !config.apiKey) {
    throw new Error("请先在设置中配置 LLM Base URL 和 API Key");
  }

  const base = normalizeOpenAIBaseUrl(config.baseUrl);
  const model = options?.model ?? config.model ?? "gpt-4o-mini";
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens;

  return withRetry(
    async () => {
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature,
      };
      if (maxTokens) body.max_tokens = maxTokens;

      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.apiKey) {
        reqHeaders.Authorization = `Bearer ${config.apiKey}`;
      }
      const res = await fetch(`${base}${OPENAI_COMPAT_PATHS.chatCompletions}`, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`LLM 请求失败: ${res.status} ${err}`);
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("LLM 未返回内容");

      return content;
    },
    LLM_RETRY_OPTIONS
  );
}
