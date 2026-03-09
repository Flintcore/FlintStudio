# FlintStudio × ComfyUI 本地模型集成技术规划

## 📋 项目概述

**目标**：让 FlintStudio 支持通过 ComfyUI API 调用本地 Stable Diffusion 模型

**优势**：
- 无需云端 API，完全本地运行，保护隐私
- 支持任意自定义模型（Checkpoint/LoRA/VAE）
- 零成本无限生成
- 可精细控制出图参数

---

## 🏗️ 架构设计

```
┌─────────────────┐     HTTP/WebSocket      ┌─────────────────┐
│   FlintStudio   │ ◄──────────────────────► │    ComfyUI      │
│   (Next.js)     │   /prompt /ws /upload   │   (本地服务)     │
│                 │                         │  127.0.0.1:8188 │
└─────────────────┘                         └─────────────────┘
        │                                            │
        │  1. 提交工作流 (Prompt)                     │
        │  2. 监听进度 (WebSocket)                    │
        │  3. 获取结果 (GET /view)                    │
        │                                            │
        ▼                                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     ComfyUI Workflow                         │
│  Load Checkpoint → CLIP Text Encode → KSampler → Save Image │
│       ↑                ↑                               │    │
│   选择模型        正向/反向提示词                    输出路径 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 文件结构规划

```
src/lib/generators/
├── comfyui-client.ts          # ComfyUI API 客户端
├── comfyui-workflows/
│   ├── base-workflow.ts       # 基础工作流模板
│   ├── storyboard-workflow.ts # 分镜专用工作流
│   └── character-workflow.ts  # 角色一致性工作流
└── comfyui-models.ts          # 本地模型管理

src/app/api/settings/comfyui/
├── route.ts                   # 配置管理 API
└── models/route.ts            # 获取可用模型列表

src/app/[locale]/settings/
├── comfyui-config.tsx         # ComfyUI 配置界面
```

---

## 🔧 核心模块设计

### 1. ComfyUI API 客户端 (comfyui-client.ts)

```typescript
export interface ComfyUIConfig {
  baseUrl: string;           // 默认 http://127.0.0.1:8188
  timeout: number;           // 默认 300000ms (5分钟)
  defaultModel: string;      // 默认 checkpoint
  defaultSteps: number;      // 默认 30 步
  defaultCfg: number;        // 默认 CFG 7.0
  defaultSampler: string;    // 默认 DPM++ 2M Karras
  defaultScheduler: string;  // 默认 normal
}

export class ComfyUIClient {
  private config: ComfyUIConfig;
  private ws: WebSocket | null = null;

  // 核心方法
  async generateImage(params: GenerationParams): Promise<string>;
  async uploadImage(image: Buffer, filename: string): Promise<string>;
  async getQueueStatus(): Promise<QueueStatus>;
  async getAvailableModels(): Promise<ModelInfo[]>;
  async interruptGeneration(): Promise<void>;
  
  // WebSocket 监听
  onProgress(callback: (progress: number) => void): void;
  onComplete(callback: (imageUrl: string) => void): void;
  onError(callback: (error: Error) => void): void;
}
```

### 2. 分镜专用工作流 (storyboard-workflow.ts)

```typescript
export function buildStoryboardWorkflow(
  prompt: string,           // 分镜描述
  visualStyleId: string,     // 画风 ID
  width: number = 1024,      // 默认 1024
  height: number = 1024,     // 默认 1024
  seed?: number,             // 随机种子（可选，用于重绘）
  referenceImage?: string    // 参考图（用于角色一致性）
): ComfyUIWorkflow {
  return {
    // ComfyUI JSON 工作流格式
    "3": {
      "inputs": {
        "seed": seed ?? Math.floor(Math.random() * 1000000),
        "steps": 30,
        "cfg": 7,
        "sampler_name": "dpmpp_2m",
        "scheduler": "karras",
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler"
    },
    // ... 其他节点
    "6": {
      "inputs": {
        "text": enhancePromptForStyle(prompt, visualStyleId),
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode"
    },
  };
}

// 画风关键词映射
const STYLE_PROMPT_ENHANCEMENTS: Record<string, string> = {
  "live_action": "photorealistic, live-action film, cinematic lighting, 8k",
  "anime": "anime style, 2D animation, cel-shading, high quality",
  "unreal_cg": "Unreal Engine 5, game cinematic, 3D render, PBR",
  // ... 其他风格
};
```

### 3. 模型管理 (comfyui-models.ts)

```typescript
export interface LocalModel {
  name: string;              // 文件名
  type: "checkpoint" | "lora" | "vae" | "controlnet";
  path: string;              // 相对路径
  size: number;              // 文件大小
  hash?: string;             // 模型哈希
  preview?: string;          // 预览图 URL
  tags?: string[];           // 标签
  description?: string;      // 描述
}

export async function scanLocalModels(): Promise<LocalModel[]> {
  // 扫描 ComfyUI 模型目录
  // checkpoints/, loras/, vae/, controlnet/
}

export async function getModelPreview(modelName: string): Promise<string | null> {
  // 获取模型预览图
}
```

---

## ⚙️ API 端点规划

### POST /api/generate/comfyui

**请求体:**
```json
{
  "prompt": "少女在樱花树下",
  "visualStyleId": "anime",
  "width": 1024,
  "height": 1024,
  "model": "anime_v3.safetensors",
  "seed": 12345,
  "steps": 30,
  "referenceImage": "..."
}
```

**响应:**
```json
{
  "success": true,
  "imageUrl": "/api/comfyui/output/12345.png",
  "seed": 12345,
  "generationTime": 15.2
}
```

### GET /api/settings/comfyui/models

**响应:**
```json
{
  "checkpoints": [
    { "name": "realistic_v5.safetensors", "size": "4.2GB" },
    { "name": "anime_v3.safetensors", "size": "2.1GB" }
  ],
  "loras": [...],
  "vaes": [...]
}
```

### GET /api/comfyui/status

检查 ComfyUI 服务是否在线

---

## 🎨 配置界面设计

### 设置页面 - ComfyUI 标签

```
┌─────────────────────────────────────────────────────────────┐
│ 🎨 ComfyUI 本地模型配置                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  服务器地址: [ http://127.0.0.1:8188        ]               │
│  [连接测试]  ✅ 已连接 (ComfyUI v0.2.2)                      │
│                                                              │
│  ─────────────────────────────────────────────────────     │
│  默认 Checkpoint: [ SDXL Base ▼ ]                           │
│  默认 VAE:       [ SDXL VAE ▼ ]                             │
│  默认采样器:     [ DPM++ 2M Karras ▼ ]                      │
│  默认步数:       [ 30 ▼ ]                                   │
│  默认 CFG:       [ 7.0 ▼ ]                                  │
│                                                              │
│  ─────────────────────────────────────────────────────     │
│  📂 模型管理                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📁 checkpoints/                                     │   │
│  │   ├─ realistic_v5.safetensors    [✓ 可用]          │   │
│  │   ├─ anime_v3.safetensors        [✓ 可用]          │   │
│  │   └─ dreamshaper_v8.safetensors  [✓ 可用]          │   │
│  │ 📁 loras/                                           │   │
│  │   ├─ anime_lineart.safetensors   [✓ 可用]          │   │
│  │   └─ detail_slider.safetensors   [✓ 可用]          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ─────────────────────────────────────────────────────     │
│  🔧 高级选项                                                  │
│  ☑️ 启用 ControlNet (需要安装节点)                           │
│  ☑️ 启用高清修复 (Hires.fix)                                  │
│  ☑️ 启用面部修复 (Face Restoration)                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 数据库 Schema 扩展

```prisma
model ComfyUIConfig {
  id                String   @id @default(uuid())
  userId            String   @unique
  baseUrl           String   @default("http://127.0.0.1:8188")
  defaultCheckpoint String?
  defaultVAE        String?
  defaultSampler    String   @default("dpmpp_2m")
  defaultScheduler  String   @default("karras")
  defaultSteps      Int      @default(30)
  defaultCfg        Float    @default(7.0)
  enableHiresFix    Boolean  @default(false)
  enableControlNet  Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id])
}
```

---

## 🚀 实施步骤

| Phase | 任务 | 预计时间 |
|-------|------|---------|
| Phase 1 | 基础 API 客户端<br>- ComfyUIClient 类<br>- HTTP API 封装<br>- WebSocket 连接管理<br>- 错误处理机制 | 2 天 |
| Phase 2 | 工作流模板<br>- 基础文生图工作流<br>- 分镜专用工作流（支持画风）<br>- 角色一致性工作流（IPAdapter）<br>- ControlNet 支持 | 2 天 |
| Phase 3 | 配置系统<br>- 设置界面开发<br>- 模型扫描与管理<br>- 配置存储 API | 1 天 |
| Phase 4 | 集成测试<br>- 与现有出图流程集成<br>- 优先级：ComfyUI > 云端 API<br>- 性能测试 | 1 天 |

**总计：约 6 天**

---

## 💡 使用示例

### 场景 1：基础文生图
```typescript
const client = new ComfyUIClient({
  baseUrl: "http://127.0.0.1:8188"
});

const imageUrl = await client.generateImage({
  prompt: "少女站在樱花树下，日式动画风格",
  visualStyleId: "anime",
  width: 1024,
  height: 1024
});
```

### 场景 2：角色一致性（IPAdapter）
```typescript
const imageUrl = await client.generateImage({
  prompt: "女主角在咖啡厅",
  referenceImage: "/path/to/character_ref.png",
  model: "realistic_v5.safetensors",
  ipAdapterScale: 0.8
});
```

### 场景 3：ControlNet 姿态控制
```typescript
const imageUrl = await client.generateImage({
  prompt: "武士战斗姿态",
  controlnetImage: "/path/to/pose.png",
  controlnetType: "openpose",
  controlnetStrength: 1.0
});
```

---

## 🔐 安全考虑

1. **本地服务限制**
   - ComfyUI 默认只监听 127.0.0.1，不暴露公网
   - 如需远程访问，建议通过 VPN/SSH 隧道

2. **模型文件安全**
   - 扫描模型文件哈希，防止恶意文件
   - 限制上传文件类型（仅 .safetensors, .pt, .ckpt）

3. **资源限制**
   - 设置单次生成超时（默认 5 分钟）
   - 限制并发请求数（避免显存溢出）
   - 队列长度限制

---

## 📚 依赖要求

**用户需要安装：**

1. ComfyUI 本体
```bash
git clone https://github.com/comfyanonymous/ComfyUI
```

2. 推荐节点（可通过 ComfyUI-Manager 安装）
- ComfyUI_IPAdapter_plus （角色一致性）
- ComfyUI_ControlNet_aux （ControlNet 预处理）
- ComfyUI-Easy-Use （简化工作流）
- WAS Node Suite （实用工具节点）

3. 模型文件
- 放入 ComfyUI/models/checkpoints/
- LoRA 放入 ComfyUI/models/loras/

---

## 🎯 预期效果

用户配置 ComfyUI 后，在 FlintStudio 中：

1. 设置 → API 配置 → 选择 "ComfyUI (本地)"
2. 填入 http://127.0.0.1:8188
3. 测试连接，选择默认模型
4. 一键生成时自动调用本地模型
5. 生成进度实时显示
6. 生成的图片自动保存到项目

---

## 📊 优势对比

| 特性 | 云端 API | ComfyUI 本地 |
|------|---------|--------------|
| 成本 | 按量付费 | 免费（电费除外） |
| 隐私 | 上传云端 | 完全本地 |
| 速度 | 网络依赖 | 本地 GPU |
| 可控性 | 有限参数 | 完全控制 |
| 模型选择 | 固定模型 | 任意模型 |
| 自定义 | 不支持 | 无限可能 |

---

**文档已保存到**: `docs/COMFYUI_INTEGRATION_PLAN.md`
