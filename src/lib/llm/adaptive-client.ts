/**
 * 自适应 LLM 客户端
 * 根据模型配置自动调整提示词策略和参数
 */

import { withRetry, LLM_RETRY_OPTIONS } from "@/lib/utils/retry";
import { normalizeOpenAIBaseUrl, OPENAI_COMPAT_PATHS } from "@/lib/openai-compat";
import { 
  getUserModelConfig, 
  type ModelConfig, 
  type PromptStrategy,
  PRESET_MODELS 
} from "./model-registry";

export interface AdaptiveLlmOptions {
  userId: string;
  modelId?: string;           // 指定模型，否则使用用户默认
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  expectJson?: boolean;
  jsonSchema?: object;        // JSON Schema 约束
}

export interface LlmResponse<T = unknown> {
  data: T;
  raw: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;  // 估算成本
}

// 根据模型策略优化系统提示词
function optimizeSystemPrompt(
  basePrompt: string, 
  strategy: PromptStrategy,
  expectJson: boolean,
  jsonSchema?: object
): string {
  let optimized = basePrompt;
  
  // 添加前缀
  if (strategy.systemPrefix) {
    optimized = `${strategy.systemPrefix}\n\n${optimized}`;
  }
  
  // JSON 模式适配
  if (expectJson && strategy.jsonMode.enabled) {
    let jsonInstruction = strategy.jsonMode.schemaInstruction;
    
    if (jsonSchema) {
      jsonInstruction += `\n\nJSON Schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
    }
    
    optimized += `\n\n${jsonInstruction}`;
  }
  
  // 添加后缀（检查清单等）
  if (strategy.systemSuffix) {
    optimized += strategy.systemSuffix;
  }
  
  // 禁用思考过程（针对推理模型）
  if (strategy.rules.disableThinking) {
    optimized += `\n\n**禁止**: 不要输出思考过程、分析步骤或解释说明。直接返回最终结果。`;
  }
  
  // 强化约束
  if (strategy.rules.reinforceConstraints) {
    optimized += `\n\n**重要**: 严格遵守上述所有约束条件，确保输出格式正确。`;
  }
  
  return optimized;
}

// 解析模型响应
function parseResponse<T>(
  rawContent: string, 
  strategy: PromptStrategy,
  expectJson: boolean
): T {
  let content = rawContent.trim();
  
  // 如果期望 JSON，尝试提取
  if (expectJson) {
    // 尝试从 markdown 代码块中提取
    if (strategy.jsonMode.wrapInMarkdown) {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        content = jsonMatch[1].trim();
      }
    }
    
    // 尝试找到 JSON 对象/数组的开始
    const jsonStart = content.indexOf('{');
    const arrayStart = content.indexOf('[');
    
    let startIndex = -1;
    if (jsonStart !== -1 && arrayStart !== -1) {
      startIndex = Math.min(jsonStart, arrayStart);
    } else if (jsonStart !== -1) {
      startIndex = jsonStart;
    } else if (arrayStart !== -1) {
      startIndex = arrayStart;
    }
    
    if (startIndex !== -1) {
      content = content.slice(startIndex);
    }
    
    // 尝试解析
    try {
      return JSON.parse(content) as T;
    } catch (e) {
      // 尝试修复常见 JSON 错误
      const fixed = tryFixJson(content);
      if (fixed) {
        return JSON.parse(fixed) as T;
      }
      throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : String(e)}\n原始内容: ${rawContent.slice(0, 500)}`);
    }
  }
  
  return content as unknown as T;
}

// 尝试修复常见 JSON 错误
function tryFixJson(content: string): string | null {
  let fixed = content;
  
  // 1. 移除尾部逗号
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  
  // 2. 尝试补全不完整的 JSON
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  
  if (openBraces > closeBraces) {
    fixed += '}'.repeat(openBraces - closeBraces);
  }
  if (openBrackets > closeBrackets) {
    fixed += ']'.repeat(openBrackets - closeBrackets);
  }
  
  // 3. 处理未闭合的字符串
  const quoteCount = (fixed.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    fixed += '"';
  }
  
  try {
    JSON.parse(fixed);
    return fixed;
  } catch {
    return null;
  }
}

// 主调用函数
export async function callAdaptiveLlm<T = unknown>(
  options: AdaptiveLlmOptions
): Promise<LlmResponse<T>> {
  const { 
    userId, 
    modelId, 
    systemPrompt, 
    userPrompt, 
    temperature, 
    maxTokens,
    expectJson = true,
    jsonSchema 
  } = options;
  
  // 1. 获取模型配置
  const config = modelId 
    ? await getUserModelConfig(userId, modelId)
    : await getDefaultModelConfig(userId);
    
  if (!config) {
    throw new Error(`未找到模型配置: ${modelId || "default"}`);
  }
  
  // 2. 优化提示词
  const optimizedSystemPrompt = optimizeSystemPrompt(
    systemPrompt, 
    config.promptStrategy, 
    expectJson,
    jsonSchema
  );
  
  // 3. 构建请求参数
  const requestParams = buildRequestParams(
    config,
    optimizedSystemPrompt,
    userPrompt,
    temperature ?? config.defaultParams.temperature,
    maxTokens ?? config.defaultParams.maxTokens,
    expectJson
  );
  
  // 4. 发送请求（带重试）
  const result = await withRetry(
    async () => sendRequest(config, requestParams),
    {
      ...LLM_RETRY_OPTIONS,
      maxAttempts: config.rateLimit.requestsPerMinute > 500 ? 3 : 5,
      onRetry: (error, attempt) => {
        console.warn(
          `[LLM:${config.id}] 第 ${attempt} 次重试，错误: ${error.message}`
        );
      },
    }
  );
  
  // 5. 解析响应
  const parsedData = parseResponse<T>(result.content, config.promptStrategy, expectJson);
  
  // 6. 计算成本
  const cost = calculateCost(config, result.usage);
  
  return {
    data: parsedData,
    raw: result.content,
    model: config.id,
    usage: result.usage,
    cost,
  };
}

// 获取用户默认模型
async function getDefaultModelConfig(userId: string): Promise<ModelConfig | null> {
  const { prisma } = await import("@/lib/db");
  
  const preference = await prisma.userPreference.findUnique({
    where: { userId },
    select: { defaultLlmModel: true },
  });
  
  const defaultModelId = preference?.defaultLlmModel || "gpt-4o-mini";
  return getUserModelConfig(userId, defaultModelId);
}

// 构建请求参数
function buildRequestParams(
  config: ModelConfig,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.3,
  maxTokens: number = 4096,
  expectJson: boolean
): Record<string, unknown> {
  const baseParams: Record<string, unknown> = {
    model: config.id,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
  };
  
  // 根据模型能力添加特殊参数
  if (expectJson && config.capabilities.includes("json_mode")) {
    // OpenAI 风格 JSON 模式
    if (config.provider === "openai" || config.provider === "deepseek" || config.provider === "moonshot") {
      baseParams.response_format = { type: "json_object" };
    }
  }
  
  // 针对特定 provider 的特殊处理
  switch (config.provider) {
    case "anthropic":
      // Claude 使用不同的参数结构
      return {
        model: config.id,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,  // Claude 的 system 是顶级参数
        messages: [{ role: "user", content: userPrompt }],
      };
      
    case "google":
      // Gemini 格式
      return {
        model: config.id,
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: expectJson ? "application/json" : "text/plain",
        },
      };
      
    default:
      return baseParams;
  }
}

// 发送 HTTP 请求
async function sendRequest(
  config: ModelConfig,
  params: Record<string, unknown>
): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  const base = normalizeOpenAIBaseUrl(config.baseUrl);
  
  // 根据 provider 确定端点
  let endpoint = `${base}${OPENAI_COMPAT_PATHS.chatCompletions}`;
  
  if (config.provider === "anthropic") {
    endpoint = `${config.baseUrl}/messages`;
  } else if (config.provider === "google") {
    endpoint = `${config.baseUrl}/models/${config.id}:generateContent`;
  }
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (config.apiKey) {
    if (config.provider === "anthropic") {
      headers["x-api-key"] = config.apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else if (config.provider === "google") {
      endpoint += `?key=${config.apiKey}`;
    } else {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
  }
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM 请求失败 (${response.status}): ${error}`);
  }
  
  const data = await response.json();
  
  // 解析不同 provider 的响应格式
  return parseProviderResponse(config.provider, data);
}

// 解析不同 provider 的响应
function parseProviderResponse(
  provider: string,
  data: Record<string, unknown>
): { content: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } } {
  switch (provider) {
    case "anthropic":
      const anthropicContent = (data.content as Array<{ type: string; text?: string }>)?.[0]?.text || "";
      const anthropicUsage = data.usage as { input_tokens?: number; output_tokens?: number };
      return {
        content: anthropicContent,
        usage: anthropicUsage ? {
          promptTokens: anthropicUsage.input_tokens || 0,
          completionTokens: anthropicUsage.output_tokens || 0,
          totalTokens: (anthropicUsage.input_tokens || 0) + (anthropicUsage.output_tokens || 0),
        } : undefined,
      };
      
    case "google":
      const googleContent = (data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>)?.[0]
        ?.content?.parts?.[0]?.text || "";
      return {
        content: googleContent,
        usage: undefined,  // Gemini 的 usage 格式不同
      };
      
    default:
      // OpenAI 兼容格式
      const choices = data.choices as Array<{ message?: { content?: string } }>;
      const content = choices?.[0]?.message?.content || "";
      const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      return {
        content,
        usage: usage ? {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        } : undefined,
      };
  }
}

// 计算成本
function calculateCost(
  config: ModelConfig,
  usage?: { promptTokens: number; completionTokens: number }
): number | undefined {
  if (!config.pricing || !usage) return undefined;
  
  const inputCost = (usage.promptTokens / 1000) * config.pricing.input;
  const outputCost = (usage.completionTokens / 1000) * config.pricing.output;
  
  return inputCost + outputCost;
}

// 设置用户默认模型
export async function setDefaultModel(userId: string, modelId: string): Promise<void> {
  const { prisma } = await import("@/lib/db");
  
  await prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      defaultLlmModel: modelId,
    },
    update: {
      defaultLlmModel: modelId,
    },
  });
}
