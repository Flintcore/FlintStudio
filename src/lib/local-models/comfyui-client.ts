/**
 * ComfyUI 本地图像生成客户端
 * 支持调用本地 Stable Diffusion 模型生成分镜图
 */

export interface ComfyUIConfig {
  baseUrl: string;           // 默认 http://localhost:8188
  timeout: number;           // 默认 300000ms (5分钟)
  defaultCheckpoint: string; // 默认 checkpoint 模型
  defaultVAE?: string;       // 默认 VAE
  defaultSteps: number;      // 默认 30 步
  defaultCfg: number;        // 默认 CFG 7.0
  defaultSampler: string;    // 默认 DPM++ 2M
  defaultScheduler: string;  // 默认 Karras
  defaultWidth: number;      // 默认 1024
  defaultHeight: number;     // 默认 1024
}

export interface ComfyUIWorkflow {
  [nodeId: string]: {
    inputs: { [key: string]: any };
    class_type: string;
    _meta?: { title?: string };
  };
}

export interface GenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  checkpoint?: string;
  vae?: string;
  batchSize?: number;
}

export interface GenerationResult {
  success: boolean;
  filename: string;
  subfolder: string;
  url: string;
  seed: number;
  generationTime: number;
}

export interface ComfyUIModel {
  name: string;
  type: "checkpoints" | "loras" | "vaes" | "controlnet" | "embeddings";
  size: number;
  preview?: string;
}

export class ComfyUIClient {
  private config: ComfyUIConfig;
  private clientId: string;

  constructor(config: Partial<ComfyUIConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || "http://localhost:8188",
      timeout: config.timeout || 300000,
      defaultCheckpoint: config.defaultCheckpoint || "sd_xl_base_1.0.safetensors",
      defaultVAE: config.defaultVAE,
      defaultSteps: config.defaultSteps || 30,
      defaultCfg: config.defaultCfg || 7.0,
      defaultSampler: config.defaultSampler || "dpmpp_2m",
      defaultScheduler: config.defaultScheduler || "karras",
      defaultWidth: config.defaultWidth || 1024,
      defaultHeight: config.defaultHeight || 1024,
    };
    this.clientId = this.generateClientId();
  }

  private generateClientId(): string {
    return `flintstudio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检查 ComfyUI 服务是否可用
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/system_stats`, {
        method: "GET",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStats(): Promise<{
    system: { os: string; python_version: string };
    devices: Array<{
      name: string;
      type: string;
      vram_total: number;
      vram_free: number;
    }>;
  }> {
    const response = await fetch(`${this.config.baseUrl}/system_stats`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to get system stats: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels(type: ComfyUIModel["type"] = "checkpoints"): Promise<
    Array<{ name: string; size: number }>
  > {
    const response = await fetch(`${this.config.baseUrl}/object_info/CheckpointLoaderSimple`, {
      method: "GET",
    });

    if (!response.ok) {
      // 如果端点不存在，返回空列表
      return [];
    }

    const data = await response.json();
    const models = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
    
    return models.map((name: string) => ({ name, size: 0 }));
  }

  /**
   * 上传图片
   */
  async uploadImage(
    image: Uint8Array | ArrayBuffer,
    filename: string,
    type: "input" | "temp" = "input"
  ): Promise<{ name: string; subfolder: string; type: string }> {
    const formData = new FormData();
    formData.append("image", new Blob([image as BlobPart]), filename);
    formData.append("type", type);
    formData.append("overwrite", "true");

    const response = await fetch(`${this.config.baseUrl}/upload/image`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 提交工作流到队列
   */
  async queuePrompt(workflow: ComfyUIWorkflow): Promise<{
    prompt_id: string;
    number: number;
    node_errors: Record<string, any>;
  }> {
    const response = await fetch(`${this.config.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: workflow,
        client_id: this.clientId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to queue prompt: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 获取历史记录
   */
  async getHistory(promptId: string): Promise<{
    prompt: ComfyUIWorkflow;
    outputs: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }>;
    status: { completed: boolean };
  }> {
    const response = await fetch(`${this.config.baseUrl}/history/${promptId}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.statusText}`);
    }

    const data = await response.json();
    return data[promptId];
  }

  /**
   * 下载生成的图片
   */
  async getImage(
    filename: string,
    subfolder: string = "",
    type: string = "output"
  ): Promise<Buffer> {
    const params = new URLSearchParams({ filename, subfolder, type });
    const response = await fetch(`${this.config.baseUrl}/view?${params}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to get image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 中断当前生成
   */
  async interrupt(): Promise<void> {
    await fetch(`${this.config.baseUrl}/interrupt`, {
      method: "POST",
    });
  }

  /**
   * 构建基础文生图工作流
   */
  buildBasicWorkflow(params: GenerationParams): ComfyUIWorkflow {
    const {
      prompt,
      negativePrompt = "blurry, low quality, worst quality, text, watermark",
      width = this.config.defaultWidth,
      height = this.config.defaultHeight,
      seed = -1,
      steps = this.config.defaultSteps,
      cfg = this.config.defaultCfg,
      sampler = this.config.defaultSampler,
      scheduler = this.config.defaultScheduler,
      checkpoint = this.config.defaultCheckpoint,
      vae = this.config.defaultVAE,
      batchSize = 1,
    } = params;

    const workflow: ComfyUIWorkflow = {
      "1": {
        inputs: { ckpt_name: checkpoint },
        class_type: "CheckpointLoaderSimple",
      },
      "2": {
        inputs: {
          text: prompt,
          clip: ["1", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "3": {
        inputs: {
          text: negativePrompt,
          clip: ["1", 1],
        },
        class_type: "CLIPTextEncode",
      },
      "4": {
        inputs: {
          width,
          height,
          batch_size: batchSize,
        },
        class_type: "EmptyLatentImage",
      },
      "5": {
        inputs: {
          seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed,
          steps,
          cfg,
          sampler_name: sampler,
          scheduler,
          denoise: 1,
          model: ["1", 0],
          positive: ["2", 0],
          negative: ["3", 0],
          latent_image: ["4", 0],
        },
        class_type: "KSampler",
      },
      "6": {
        inputs: {
          samples: ["5", 0],
          vae: vae ? ["7", 0] : ["1", 2],
        },
        class_type: "VAEDecode",
      },
      "8": {
        inputs: {
          filename_prefix: "FlintStudio",
          images: ["6", 0],
        },
        class_type: "SaveImage",
      },
    };

    // 如果使用独立的 VAE
    if (vae) {
      workflow["7"] = {
        inputs: { vae_name: vae },
        class_type: "VAELoader",
      };
    }

    return workflow;
  }

  /**
   * 生成图片（完整流程）
   */
  async generateImage(params: GenerationParams): Promise<GenerationResult> {
    const startTime = Date.now();

    // 1. 构建工作流
    const workflow = this.buildBasicWorkflow(params);

    // 2. 提交任务
    const { prompt_id } = await this.queuePrompt(workflow);

    // 3. 轮询等待完成
    let completed = false;
    let retries = 0;
    const maxRetries = Math.ceil(this.config.timeout / 1000);

    while (!completed && retries < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000));
      
      try {
        const history = await this.getHistory(prompt_id);
        if (history?.status?.completed) {
          completed = true;
        }
      } catch {
        // 忽略错误，继续轮询
      }
      
      retries++;
    }

    if (!completed) {
      throw new Error("Generation timeout");
    }

    // 4. 获取结果
    const history = await this.getHistory(prompt_id);
    const outputs = history?.outputs || {};

    // 找到 SaveImage 节点的输出
    let imageInfo: { filename: string; subfolder: string; type: string } | null = null;
    
    for (const nodeId of Object.keys(outputs)) {
      const nodeOutput = outputs[nodeId];
      if (nodeOutput.images && nodeOutput.images.length > 0) {
        imageInfo = nodeOutput.images[0];
        break;
      }
    }

    if (!imageInfo) {
      throw new Error("No image generated");
    }

    const generationTime = Date.now() - startTime;

    return {
      success: true,
      filename: imageInfo.filename,
      subfolder: imageInfo.subfolder,
      url: `/api/comfyui/image?filename=${encodeURIComponent(imageInfo.filename)}&subfolder=${encodeURIComponent(imageInfo.subfolder)}&type=${imageInfo.type}`,
      seed: params.seed || 0,
      generationTime,
    };
  }

  /**
   * WebSocket 实时监听（可选）- 仅在 Node.js 环境可用
   */
  async *trackProgress(promptId: string): AsyncGenerator<{
    type: string;
    data: any;
  }> {
    // 动态导入 ws 模块（仅在服务端）
    let WebSocket: any;
    try {
      const wsModule = await import("ws");
      WebSocket = wsModule.default;
    } catch {
      throw new Error("WebSocket tracking is only available in Node.js environment");
    }

    const wsUrl = `ws://${this.config.baseUrl.replace(/^https?:\/\//, "")}/ws?clientId=${this.clientId}`;
    const ws = new WebSocket(wsUrl);

    let completed = false;

    ws.on("message", (data: Buffer) => {
      if (data[0] === 0x01) {
        // 二进制预览图消息，忽略
        return;
      }

      try {
        const message = JSON.parse(data.toString());
        if (message.type === "execution_success" && message.data.prompt_id === promptId) {
          completed = true;
        }
      } catch {
        // 忽略解析错误
      }
    });

    // 等待完成或超时
    const startTime = Date.now();
    while (!completed && Date.now() - startTime < this.config.timeout) {
      await new Promise((r) => setTimeout(r, 100));
    }

    ws.close();
  }

  /**
   * 获取配置
   */
  getConfig(): ComfyUIConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ComfyUIConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// 导出单例实例
let defaultClient: ComfyUIClient | null = null;

export function getComfyUIClient(config?: Partial<ComfyUIConfig>): ComfyUIClient {
  if (!defaultClient || config) {
    defaultClient = new ComfyUIClient(config);
  }
  return defaultClient;
}

export function resetComfyUIClient(): void {
  defaultClient = null;
}
