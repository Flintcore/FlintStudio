/**
 * Ollama 本地大模型客户端
 * 支持调用本地 LLM 进行剧本分析、分场、分镜等任务
 */

export interface OllamaConfig {
  baseUrl: string;           // 默认 http://localhost:11434
  model: string;             // 模型名称，如 llama3.2, qwen2.5
  temperature?: number;      // 默认 0.7
  topP?: number;             // 默认 0.9
  maxTokens?: number;        // 默认 2048
  keepAlive?: string;        // 模型保持时间，默认 "5m"
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
  };
  response?: string;         // /api/generate 格式
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaClient {
  private config: OllamaConfig;

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || "http://localhost:11434",
      model: config.model || "llama3.2",
      temperature: config.temperature ?? 0.7,
      topP: config.topP ?? 0.9,
      maxTokens: config.maxTokens ?? 2048,
      keepAlive: config.keepAlive || "5m",
    };
  }

  /**
   * 检查 Ollama 服务是否可用
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 列出本地可用的模型
   */
  async listModels(): Promise<
    Array<{
      name: string;
      size: number;
      digest: string;
      modified_at: string;
      details?: {
        format: string;
        family: string;
        parameter_size: string;
        quantization_level: string;
      };
    }>
  > {
    const response = await fetch(`${this.config.baseUrl}/api/tags`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.models || [];
  }

  /**
   * 非流式生成文本（使用 /api/chat）
   */
  async generate(messages: OllamaMessage[]): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
        options: {
          temperature: this.config.temperature,
          top_p: this.config.topP,
          num_predict: this.config.maxTokens,
        },
        keep_alive: this.config.keepAlive,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data: OllamaResponse = await response.json();
    return data.message?.content || "";
  }

  /**
   * 流式生成文本
   */
  async *generateStream(messages: OllamaMessage[]): AsyncGenerator<string> {
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
        options: {
          temperature: this.config.temperature,
          top_p: this.config.topP,
          num_predict: this.config.maxTokens,
        },
        keep_alive: this.config.keepAlive,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk: OllamaResponse = JSON.parse(line);
            if (chunk.message?.content) {
              yield chunk.message.content;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 简单的单轮对话
   */
  async chat(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: OllamaMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });
    return this.generate(messages);
  }

  /**
   * 生成 JSON 格式的输出
   */
  async generateJson<T>(
    messages: OllamaMessage[],
    options?: {
      retries?: number;
      timeout?: number;
    }
  ): Promise<T> {
    const maxRetries = options?.retries ?? 3;
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              ...messages,
              {
                role: "system",
                content:
                  "You must respond with valid JSON only. No markdown, no explanations.",
              },
            ],
            stream: false,
            format: "json",
            options: {
              temperature: this.config.temperature,
              top_p: this.config.topP,
              num_predict: this.config.maxTokens,
            },
            keep_alive: this.config.keepAlive,
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data: OllamaResponse = await response.json();
        const content = data.message?.content || "";
        
        // 尝试解析 JSON
        return JSON.parse(content) as T;
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          // 指数退避
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
        }
      }
    }

    throw lastError || new Error("Failed to generate JSON after retries");
  }

  /**
   * 拉取模型
   */
  async pullModel(modelName?: string): Promise<void> {
    const model = modelName || this.config.model;
    const response = await fetch(`${this.config.baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: model,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }
  }

  /**
   * 获取配置
   */
  getConfig(): OllamaConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<OllamaConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// 导出单例实例，方便全局使用
let defaultClient: OllamaClient | null = null;

export function getOllamaClient(config?: Partial<OllamaConfig>): OllamaClient {
  if (!defaultClient || config) {
    defaultClient = new OllamaClient(config);
  }
  return defaultClient;
}

export function resetOllamaClient(): void {
  defaultClient = null;
}
