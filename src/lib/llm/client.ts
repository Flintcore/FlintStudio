import { getUserApiConfig } from "@/lib/api-config";
import { normalizeOpenAIBaseUrl, OPENAI_COMPAT_PATHS } from "@/lib/openai-compat";
import { withRetry, LLM_RETRY_OPTIONS } from "@/lib/utils/retry";

/**
 * 健壮 JSON 提取器。
 * 部分模型（DeepSeek、Qwen、Ollama 等）不支持 response_format=json_object，
 * 会在 JSON 外层包裹 ```json ... ``` 代码块，或在前后添加说明文字。
 * 多级尝试：① 直接解析 ② 提取所有 json 代码块 ③ 智能提取 JSON 对象/数组
 */
function extractJson<T>(content: string): T {
  // 1. 直接解析（去除前后空白）
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // 继续尝试
  }

  // 2. 提取 ```json ... ``` 或 ``` ... ``` 代码块（全局匹配，取第一个有效的）
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
  let match: RegExpExecArray | null;
  const codeBlocks: string[] = [];
  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match[1]) codeBlocks.push(match[1].trim());
  }
  for (const block of codeBlocks) {
    try {
      return JSON.parse(block) as T;
    } catch {
      // 继续尝试下一个代码块
    }
  }

  // 3. 智能提取：找到第一个 { 或 [，然后配对找结尾
  // 使用栈来处理嵌套，正确处理字符串中的括号
  const extractStructure = (startChar: "{" | "[", endChar: "}" | "]"): T | null => {
    let startIdx = -1;
    for (let i = 0; i < content.length; i++) {
      if (content[i] === startChar) {
        startIdx = i;
        break;
      }
    }
    if (startIdx === -1) return null;

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIdx; i < content.length; i++) {
      const ch = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (ch === "\\") {
        escapeNext = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === startChar) {
        depth++;
      } else if (ch === endChar) {
        depth--;
        if (depth === 0) {
          try {
            const jsonStr = content.slice(startIdx, i + 1);
            return JSON.parse(jsonStr) as T;
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  };

  // 先尝试提取对象 {}
  const objResult = extractStructure("{", "}");
  if (objResult !== null) return objResult;

  // 再尝试提取数组 []
  const arrResult = extractStructure("[", "]");
  if (arrResult !== null) return arrResult;

  // 4. 清理常见的前缀/后缀后再次尝试
  // 移除常见的 Markdown 前缀
  const cleaned = content
    .replace(/^\s*Here\s+(?:is|are)\s+(?:the|a)\s+JSON\s+(?:object|array|response)[:\s]*/i, "")
    .replace(/^\s*JSON[:\s]*/i, "")
    .replace(/\s*```\s*$/g, "")
    .trim();

  if (cleaned !== content) {
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // 继续
    }
  }

  // 所有尝试都失败了
  const preview = content.slice(0, 500).replace(/\s+/g, " ");
  throw new Error(
    `无法从 LLM 响应中提取有效 JSON。内容预览: "${preview}${content.length > 500 ? "..." : ""}"`
  );
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
