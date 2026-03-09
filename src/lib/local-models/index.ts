/**
 * 本地模型统一导出
 * 支持 Ollama (LLM) 和 ComfyUI (图像生成)
 */

export * from "./ollama-client";
export * from "./comfyui-client";

import { OllamaClient, getOllamaClient } from "./ollama-client";
import { ComfyUIClient, getComfyUIClient } from "./comfyui-client";

export interface LocalModelConfig {
  ollama?: {
    enabled: boolean;
    baseUrl: string;
    model: string;
  };
  comfyui?: {
    enabled: boolean;
    baseUrl: string;
    defaultCheckpoint: string;
  };
}

/**
 * 本地模型管理器
 */
export class LocalModelManager {
  private ollamaClient: OllamaClient | null = null;
  private comfyuiClient: ComfyUIClient | null = null;
  private config: LocalModelConfig;

  constructor(config: LocalModelConfig) {
    this.config = config;
    this.initClients();
  }

  private initClients(): void {
    if (this.config.ollama?.enabled) {
      this.ollamaClient = new OllamaClient({
        baseUrl: this.config.ollama.baseUrl,
        model: this.config.ollama.model,
      });
    }

    if (this.config.comfyui?.enabled) {
      this.comfyuiClient = new ComfyUIClient({
        baseUrl: this.config.comfyui.baseUrl,
        defaultCheckpoint: this.config.comfyui.defaultCheckpoint,
      });
    }
  }

  /**
   * 获取 Ollama 客户端
   */
  getOllama(): OllamaClient {
    if (!this.ollamaClient) {
      throw new Error("Ollama is not enabled");
    }
    return this.ollamaClient;
  }

  /**
   * 获取 ComfyUI 客户端
   */
  getComfyUI(): ComfyUIClient {
    if (!this.comfyuiClient) {
      throw new Error("ComfyUI is not enabled");
    }
    return this.comfyuiClient;
  }

  /**
   * 检查 Ollama 是否可用
   */
  async isOllamaAvailable(): Promise<boolean> {
    if (!this.ollamaClient) return false;
    return this.ollamaClient.checkConnection();
  }

  /**
   * 检查 ComfyUI 是否可用
   */
  async isComfyUIAvailable(): Promise<boolean> {
    if (!this.comfyuiClient) return false;
    return this.comfyuiClient.checkConnection();
  }

  /**
   * 获取所有可用本地模型
   */
  async getAvailableModels(): Promise<{
    ollama: Array<{ name: string; size: number }>;
    comfyui: Array<{ name: string; type: string }>;
  }> {
    const result = {
      ollama: [] as Array<{ name: string; size: number }>,
      comfyui: [] as Array<{ name: string; type: string }>,
    };

    if (this.ollamaClient) {
      try {
        const models = await this.ollamaClient.listModels();
        result.ollama = models.map((m) => ({
          name: m.name,
          size: m.size,
        }));
      } catch {
        // 忽略错误
      }
    }

    if (this.comfyuiClient) {
      try {
        const checkpoints = await this.comfyuiClient.getAvailableModels("checkpoints");
        result.comfyui = checkpoints.map((m) => ({
          name: m.name,
          type: "checkpoint",
        }));
      } catch {
        // 忽略错误
      }
    }

    return result;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LocalModelConfig>): void {
    this.config = { ...this.config, ...config };
    this.initClients();
  }
}

// 导出单例
let defaultManager: LocalModelManager | null = null;

export function getLocalModelManager(config?: LocalModelConfig): LocalModelManager {
  if (!defaultManager || config) {
    if (!config) {
      // 从环境变量或默认值创建配置
      config = {
        ollama: {
          enabled: process.env.OLLAMA_ENABLED === "true",
          baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
          model: process.env.OLLAMA_MODEL || "llama3.2",
        },
        comfyui: {
          enabled: process.env.COMFYUI_ENABLED === "true",
          baseUrl: process.env.COMFYUI_BASE_URL || "http://localhost:8188",
          defaultCheckpoint: process.env.COMFYUI_CHECKPOINT || "sd_xl_base_1.0.safetensors",
        },
      };
    }
    defaultManager = new LocalModelManager(config);
  }
  return defaultManager;
}
