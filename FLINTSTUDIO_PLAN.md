# FlintStudio 开源版 — 项目规划与架构

## 1. 项目定位

**FlintStudio** 是一款开源、可自托管、**全 API 可配置** 的 AI 影视自动化一体多 Agent 协同平台。  
仿照 [waoowaoo](https://github.com/waoowaooAI/waoowaoo) 的能力与技术栈，实现从小说/剧本到成片的完整流水线，所有 AI 服务（LLM、图像、视频、语音）均支持自行配置 API，无厂商锁定。

### 1.1 设计原则

- **Open-Claw 级别**：功能完整、可自部署、API 全可配、无内置计费/商业绑定。
- **技术栈与 waoowaoo 对齐**：Next.js 15、React 19、MySQL、Prisma、Redis、BullMQ、Tailwind v4、NextAuth。
- **多 Agent 协同**：剧本分析 → 角色/场景 → 分镜 → 配音 → 视频合成，任务队列驱动，支持重试与进度追踪。

---

## 2. 技术栈

| 层级     | 技术选型        | 说明 |
|----------|-----------------|------|
| 前端     | Next.js 15 + React 19 | App Router、Server Components |
| 样式     | Tailwind CSS v4 | 与 waoowaoo 一致 |
| 数据库   | MySQL 8 + Prisma ORM | 项目/剧集/角色/分镜/任务等 |
| 队列     | Redis + BullMQ  | 图像/视频/语音/文本四类 Worker |
| 认证     | NextAuth.js     | 用户名密码 + 可选 OAuth |
| 国际化   | next-intl       | 中文 / 英文 |
| 视频合成 | Remotion 或 FFmpeg | 分镜图 + 配音合成成片 |

---

## 3. 核心模块

### 3.1 API 配置中心（全可配）

- **LLM**：OpenRouter / 自建 OpenAI 兼容端点，Base URL + API Key 可配。
- **图像**：OpenAI 兼容、FAL、Google（Gemini）、火山引擎等，均通过「提供商 + 模型 + Key」配置。
- **视频**：可配置端点（如 FAL Kling、Minimax、自建），无硬编码厂商。
- **语音/TTS**：可配置多提供商（如阿里百炼、FAL、自建），支持音色与语速。
- 配置存储：`UserPreference` 表 + 可选 `customProviders` JSON，密钥加密存储。

### 3.2 多 Agent 工作流（Dify/n8n 风格自动推进）

- **工作流引擎**：内置 `novel-to-video` 流程，按 DAG 阶段自动推进；Worker 完成任务后调用 `POST /api/workflows/advance`，由服务端决定下一阶段并自动入队。
- **阶段顺序**：`analyze_novel` → `story_to_script`（每集）→ `script_to_storyboard` → `image_panels` → `voice` → `video`。

| Agent/阶段   | 输入           | 输出           | 队列/Worker |
|--------------|----------------|----------------|-------------|
| 剧本分析     | 小说/剧本文本  | 角色、场景、集数、分场 | text worker |
| 角色/场景    | 项目设定       | 角色立绘、场景图     | image worker |
| 分镜生成     | 场次文本       | 分镜图/镜头描述      | image + text |
| 配音         | 对白 + 音色    | 每句音频 + SRT      | voice worker |
| 视频合成     | 分镜图 + 音频  | 成片 MP4            | video worker |

任务状态与进度通过 `Task` / `GraphRun` / `GraphStep` 持久化，前端通过轮询 `GET /api/workflows/runs/:runId` 展示进度。

### 3.3 数据模型（精简与扩展）

- **User / Account / Session**：NextAuth 标准。
- **Project / NovelPromotionProject**：项目与剧集配置（模型选择、画风、分辨率等）。
- **NovelPromotionCharacter / Location**：角色与场景及图片引用。
- **NovelPromotionEpisode / Clip / Shot / Storyboard / Panel**：集 → 场 → 镜头 → 分镜图。
- **NovelPromotionVoiceLine**：对白与配音结果。
- **Task / GraphRun / GraphStep**：异步任务与工作流运行态。
- **MediaObject**：统一媒体存储（本地或 COS），便于切换存储后端。
- **UserPreference**：用户级 API 与模型偏好（全 API 可配）。

---

## 4. 目录结构（建议）

```
FlintStudio/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── page.tsx
│   │   │   ├── workspace/
│   │   │   ├── profile/          # 设置与 API 配置
│   │   │   └── auth/
│   │   └── api/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── redis.ts
│   │   ├── task/                  # 任务提交、状态、队列
│   │   ├── workers/               # BullMQ image/video/voice/text
│   │   ├── llm/                  # LLM 调用（统一走配置）
│   │   ├── generators/           # 图像/视频/语音生成（可插拔）
│   │   └── i18n/
│   └── components/
├── docker-compose.yml
├── .env.example
├── README.md
└── LICENSE (MIT)
```

---

## 5. 实施阶段

| 阶段 | 内容 |
|------|------|
| 1 | 规划与脚手架：本文档 + Next.js + Prisma + Redis + BullMQ + Docker |
| 2 | 数据模型与迁移：Prisma schema + docker-compose MySQL/Redis |
| 3 | API 配置中心：设置页 + 读写 UserPreference + 加密 Key |
| 4 | 剧本分析 Agent：小说解析 → 角色/场景/集数/分场（text worker） |
| 5 | 角色与场景 Agent：图像生成 Worker + 可配置图像 API |
| 6 | 分镜 Agent：场次 → 分镜图与描述（image + text） |
| 7 | 配音 Agent：TTS Worker + 可配置语音 API |
| 8 | 视频合成 Agent：分镜图 + 音频 → 成片（video worker） |
| 9 | 前端页面与中英双语：工作台、项目、设置、任务进度 |
| 10 | 文档与发布：README、.env.example、LICENSE、GitHub Release |

---

## 6. 与 waoowaoo 的差异（开源版侧重）

- **无内置计费**：不包含余额/扣费逻辑，可后续自行扩展。
- **全 API 自配置**：不绑定任何一家厂商，所有 Key/BaseURL 来自环境变量或设置中心。
- **可裁剪**：保留核心流水线，复杂计费/资产中心等可按需二次开发。
- **品牌独立**：FlintStudio 开源版，独立仓库与发布。

---

## 7. GitHub 发布清单

- [ ] 仓库名：FlintStudio 或 flint-studio
- [ ] README：中英双语、快速开始、Docker 一键启动、API 配置说明
- [ ] .env.example：列出所有可配置项并注释
- [ ] LICENSE：MIT
- [ ] 首个 Release：v0.1.0 标注「开源版 / 全 API 可配」

以上为 FlintStudio 开源版整体规划，实施时按阶段迭代即可。
