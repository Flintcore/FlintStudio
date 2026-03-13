/**
 * LLM 模型注册表 - 轻量级多模型适配器
 * 支持用户自定义配置模型参数和提示词策略
 */

export type ModelProvider = 
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "moonshot"
  | "zhipu"
  | "openrouter"
  | "local"
  | "custom";

export type ModelCapability = 
  | "json_mode"
  | "function_calling"
  | "vision"
  | "streaming"
  | "reasoning"
  | "long_context";

export interface ModelConfig {
  id: string;                    // 唯一标识，如 "gpt-4o-mini"
  name: string;                  // 显示名称
  provider: ModelProvider;
  baseUrl: string;
  apiKey?: string;
  
  // 模型能力
  capabilities: ModelCapability[];
  
  // 默认参数
  defaultParams: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
  
  // 提示词适配策略
  promptStrategy: PromptStrategy;
  
  // 速率限制
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute?: number;
  };
  
  // 成本估算 (每1K tokens)
  pricing?: {
    input: number;
    output: number;
  };
}

export interface PromptStrategy {
  // 系统提示词前缀
  systemPrefix?: string;
  
  // 系统提示词后缀（检查清单等）
  systemSuffix?: string;
  
  // JSON 模式适配
  jsonMode: {
    enabled: boolean;
    schemaInstruction?: string;  // 如何描述JSON格式
    wrapInMarkdown?: boolean;    // 是否用 ```json 包裹
  };
  
  // Few-shot 示例格式
  fewShotFormat: "xml" | "markdown" | "json" | "plain";
  
  // 特殊处理规则
  rules: {
    // 是否需要在提示词中明确禁止思考过程
    disableThinking?: boolean;
    // 是否需要重复强调约束
    reinforceConstraints?: boolean;
    // 是否使用特殊分隔符
    useDelimiters?: boolean;
  };
}

// 预置模型配置
export const PRESET_MODELS: Record<string, ModelConfig> = {
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    capabilities: ["json_mode", "function_calling", "vision", "streaming", "long_context"],
    defaultParams: {
      temperature: 0.3,
      maxTokens: 4096,
    },
    promptStrategy: {
      jsonMode: {
        enabled: true,
        schemaInstruction: "Respond with valid JSON",
        wrapInMarkdown: false,
      },
      fewShotFormat: "json",
      rules: {
        disableThinking: false,
        reinforceConstraints: false,
        useDelimiters: false,
      },
    },
    rateLimit: {
      requestsPerMinute: 500,
    },
    pricing: { input: 0.0025, output: 0.01 },
  },
  
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    capabilities: ["json_mode", "function_calling", "vision", "streaming", "long_context"],
    defaultParams: {
      temperature: 0.2,  // 更低温度减少随机性
      maxTokens: 4096,
    },
    promptStrategy: {
      systemSuffix: `\n\n## 强制检查清单（输出前逐项确认）
□ 所有必填字段已填充，无空值
□ JSON 格式正确，可被正常解析
□ 未添加任何解释性文字，仅返回 JSON`,
      jsonMode: {
        enabled: true,
        schemaInstruction: "Respond with valid JSON only. No markdown, no explanations.",
        wrapInMarkdown: false,
      },
      fewShotFormat: "json",
      rules: {
        disableThinking: false,
        reinforceConstraints: true,  // 廉价模型需要强化约束
        useDelimiters: true,
      },
    },
    rateLimit: {
      requestsPerMinute: 1000,
    },
    pricing: { input: 0.00015, output: 0.0006 },
  },
  
  "claude-3-5-sonnet": {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    capabilities: ["json_mode", "vision", "streaming", "long_context"],
    defaultParams: {
      temperature: 0.3,
      maxTokens: 4096,
    },
    promptStrategy: {
      systemPrefix: "You are a helpful assistant that always responds with valid JSON.",
      jsonMode: {
        enabled: true,
        schemaInstruction: "Your response must be valid JSON.",
        wrapInMarkdown: true,  // Claude 喜欢用 markdown
      },
      fewShotFormat: "xml",  // Claude 擅长 XML 格式
      rules: {
        disableThinking: false,
        reinforceConstraints: false,
        useDelimiters: false,
      },
    },
    rateLimit: {
      requestsPerMinute: 400,
    },
    pricing: { input: 0.003, output: 0.015 },
  },
  
  "deepseek-chat": {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    capabilities: ["json_mode", "streaming", "long_context"],
    defaultParams: {
      temperature: 0.3,
      maxTokens: 4096,
    },
    promptStrategy: {
      jsonMode: {
        enabled: true,
        schemaInstruction: "以JSON格式返回",
        wrapInMarkdown: false,
      },
      fewShotFormat: "json",
      rules: {
        disableThinking: false,
        reinforceConstraints: true,
        useDelimiters: true,
      },
    },
    rateLimit: {
      requestsPerMinute: 300,
    },
    pricing: { input: 0.00014, output: 0.00028 },
  },
  
  "deepseek-reasoner": {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    capabilities: ["reasoning", "streaming", "long_context"],
    defaultParams: {
      temperature: 0.3,
      maxTokens: 4096,
    },
    promptStrategy: {
      systemSuffix: `\n\n**重要**: 不要输出思考过程，直接返回最终结果。`,
      jsonMode: {
        enabled: true,
        schemaInstruction: "直接返回JSON结果",
        wrapInMarkdown: false,
      },
      fewShotFormat: "json",
      rules: {
        disableThinking: true,  // 推理模型需要禁用思考过程
        reinforceConstraints: true,
        useDelimiters: true,
      },
    },
    rateLimit: {
      requestsPerMinute: 100,
    },
    pricing: { input: 0.00014, output: 0.00028 },
  },
  
  "moonshot-v1-8k": {
    id: "moonshot-v1-8k",
    name: "Moonshot (月之暗面)",
    provider: "moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    capabilities: ["json_mode", "streaming", "long_context"],
    defaultParams: {
      temperature: 0.3,
      maxTokens: 4096,
    },
    promptStrategy: {
      jsonMode: {
        enabled: true,
        schemaInstruction: "返回JSON格式",
        wrapInMarkdown: false,
      },
      fewShotFormat: "json",
      rules: {
        disableThinking: false,
        reinforceConstraints: true,
        useDelimiters: true,
      },
    },
    rateLimit: {
      requestsPerMinute: 200,
    },
    pricing: { input: 0.00012, output: 0.00012 },
  },
  
  "glm-4": {
    id: "glm-4",
    name: "GLM-4 (智谱)",
    provider: "zhipu",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    capabilities: ["json_mode", "streaming", "long_context"],
    defaultParams: {
      temperature: 0.3,
      maxTokens: 4096,
    },
    promptStrategy: {
      jsonMode: {
        enabled: true,
        schemaInstruction: "以JSON格式输出",
        wrapInMarkdown: false,
      },
      fewShotFormat: "json",
      rules: {
        disableThinking: false,
        reinforceConstraints: true,
        useDelimiters: true,
      },
    },
    rateLimit: {
      requestsPerMinute: 200,
    },
    pricing: { input: 0.0001, output: 0.0001 },
  },
  
  "local-llm": {
    id: "local",
    name: "本地模型",
    provider: "local",
    baseUrl: "http://localhost:11434/v1",  // Ollama 默认
    capabilities: ["streaming"],
    defaultParams: {
      temperature: 0.3,
      maxTokens: 4096,
    },
    promptStrategy: {
      systemSuffix: `\n\n必须返回有效的JSON格式数据。`,
      jsonMode: {
        enabled: false,  // 本地模型通常不支持原生 JSON 模式
        schemaInstruction: "返回JSON格式",
        wrapInMarkdown: true,
      },
      fewShotFormat: "json",
      rules: {
        disableThinking: false,
        reinforceConstraints: true,
        useDelimiters: true,
      },
    },
    rateLimit: {
      requestsPerMinute: 60,
    },
  },
};

// 获取模型配置
export function getModelConfig(modelId: string): ModelConfig | null {
  return PRESET_MODELS[modelId] || null;
}

// 获取用户自定义模型配置
export async function getUserModelConfig(userId: string, modelId: string): Promise<ModelConfig | null> {
  const { prisma } = await import("@/lib/db");
  
  const preference = await prisma.userPreference.findUnique({
    where: { userId },
    select: { customModels: true },
  });
  
  if (!preference?.customModels) {
    return getModelConfig(modelId);
  }
  
  try {
    const customModels = JSON.parse(preference.customModels) as Record<string, Partial<ModelConfig>>;
    const customConfig = customModels[modelId];
    
    if (!customConfig) {
      return getModelConfig(modelId);
    }
    
    // 合并预设和用户自定义
    const preset = getModelConfig(modelId);
    if (!preset) return null;
    
    return {
      ...preset,
      ...customConfig,
      defaultParams: {
        ...preset.defaultParams,
        ...customConfig.defaultParams,
      },
      promptStrategy: {
        ...preset.promptStrategy,
        ...customConfig.promptStrategy,
        jsonMode: {
          ...preset.promptStrategy.jsonMode,
          ...customConfig.promptStrategy?.jsonMode,
        },
        rules: {
          ...preset.promptStrategy.rules,
          ...customConfig.promptStrategy?.rules,
        },
      },
    } as ModelConfig;
  } catch {
    return getModelConfig(modelId);
  }
}

// 保存用户自定义模型配置
export async function saveUserModelConfig(
  userId: string, 
  modelId: string, 
  config: Partial<ModelConfig>
): Promise<void> {
  const { prisma } = await import("@/lib/db");
  
  const preference = await prisma.userPreference.findUnique({
    where: { userId },
    select: { customModels: true },
  });
  
  let customModels: Record<string, Partial<ModelConfig>> = {};
  
  if (preference?.customModels) {
    try {
      customModels = JSON.parse(preference.customModels);
    } catch {
      customModels = {};
    }
  }
  
  customModels[modelId] = {
    ...customModels[modelId],
    ...config,
  };
  
  await prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      customModels: JSON.stringify(customModels),
    },
    update: {
      customModels: JSON.stringify(customModels),
    },
  });
}

// 获取所有可用模型列表
export function getAvailableModels(): { id: string; name: string; provider: ModelProvider }[] {
  return Object.values(PRESET_MODELS).map(m => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
  }));
}
