<p align="center">
  <img src="https://img.shields.io/badge/FlintStudio-Open%20Source-amber?style=for-the-badge" alt="FlintStudio" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Node-18%2B-green?style=for-the-badge" alt="Node" />
</p>

<h1 align="center">🔥 FlintStudio</h1>
<p align="center">
  <strong>从小说到成片，一条龙 AI 影视流水线 · Novel to Video in One Click</strong>
</p>
<p align="center">
  <strong>全 API 可配置 · 多 Agent 自动协同 · 无厂商锁定</strong><br />
  <strong>Fully configurable APIs · Multi-agent automation · No vendor lock-in</strong>
</p>

<p align="center">
  <a href="#-功能--features">功能</a> •
  <a href="#-快速开始--quick-start">快速开始</a> •
  <a href="#-配置--configuration">配置</a> •
  <a href="#-流程--workflow">流程</a> •
  <a href="#-技术栈--tech-stack">技术栈</a> •
</p>

---

## 📖 简介 · About

**中文**  
FlintStudio 是一款**开源、可自托管**的 AI 影视自动化平台。粘贴小说或剧本，一键启动工作流，系统将**自动按 DAG 执行**：剧本分析 → 分场 → 分镜 → 出图 → 配音 → 视频合成，无需逐步点击。所有 AI 服务（LLM、图像、TTS）均在「设置」中配置 Base URL 与 API Key，**无厂商绑定**，可对接 OpenRouter、OpenAI、自建端点等，面向从短剧到成片的完整流水线。

**English**  
FlintStudio is an **open-source, self-hosted** AI film automation platform. Paste a novel or script, hit one button, and the pipeline **runs automatically**: script analysis → scene splitting → storyboard → image generation → voiceover (TTS) → video composition (FFmpeg). No clicking through each step. All AI services (LLM, image, TTS) are configured in Settings with your own Base URL and API Key—**no vendor lock-in**. Use OpenRouter, OpenAI, or any compatible endpoint for a full novel-to-video workflow.

---

## ✨ 功能 · Features

**中文**

| 功能 | 说明 |
|------|------|
| 🎬 **多 Agent 自动工作流** | 类似 Dify/n8n：一键粘贴后按 DAG 自动执行，Worker 完成即推进下一阶段 |
| 📜 **剧本分析** | LLM 解析小说 → 角色、场景、集数落库（可配 OpenRouter / 自建） |
| 📑 **分场** | 每集正文 → LLM 拆分为多场（摘要、场景、人物、正文）→ Clip |
| 🎞️ **分镜** | 每场 → LLM 拆分为多镜头（描述、绘图提示）→ Storyboard + Panel |
| 🖼️ **分镜出图** | 每镜头调用可配置图像 API 生成分镜图并写回 Panel |
| 🎙️ **配音** | 提取对白（LLM）→ 可配置 TTS 生成每条音频 → VoiceLine |
| 🎥 **视频合成** | 分镜图 + 配音经 FFmpeg 合成为一集 MP4 → Episode.videoUrl |
| ⚙️ **设置中心** | 所有 API（LLM、图像、语音）Base URL + API Key 在设置中配置 |

**English**

| Feature | Description |
|---------|-------------|
| 🎬 **Multi-agent workflow** | Dify/n8n-style: paste once, DAG runs automatically; workers advance to the next stage on completion |
| 📜 **Script analysis** | LLM parses novel → characters, locations, episodes persisted (OpenRouter / self-hosted) |
| 📑 **Scene splitting** | Per-episode text → LLM splits into scenes (summary, location, characters) → Clip |
| 🎞️ **Storyboard** | Per scene → LLM splits into panels (description, image prompt) → Storyboard + Panel |
| 🖼️ **Panel images** | Configurable image API generates one image per panel → Panel.imageUrl |
| 🎙️ **Voiceover** | Extract dialogue (LLM) → configurable TTS per line → VoiceLine.audioUrl |
| 🎥 **Video composition** | FFmpeg merges panels + voice into one MP4 per episode → Episode.videoUrl |
| ⚙️ **Settings** | All APIs (LLM, image, TTS) configured via Base URL + API Key in Settings |

---

## 🚀 快速开始 · Quick Start

### 中文

**前置条件**：安装 [Docker Desktop](https://docs.docker.com/get-docker/)（或本地 Node.js 18+、MySQL 8、Redis）

```bash
git clone https://github.com/YOUR_USERNAME/FlintStudio.git
cd FlintStudio
docker compose up -d
```

打开 **http://localhost:13000**，注册/登录 → 工作台 → 新建项目 → 粘贴小说 → 点击「启动工作流」。首次启动会自动完成数据库初始化。

**本地开发**（需已启动 MySQL、Redis）：

```bash
cp .env.example .env
# 编辑 .env：DATABASE_URL、REDIS_HOST 等
npm install
npx prisma db push
npm run dev
```

访问 http://localhost:3000。Worker 会随 `npm run dev` 一起启动。

---

### English

**Prerequisites**: [Docker Desktop](https://docs.docker.com/get-docker/) (or local Node.js 18+, MySQL 8, Redis)

```bash
git clone https://github.com/YOUR_USERNAME/FlintStudio.git
cd FlintStudio
docker compose up -d
```

Open **http://localhost:13000**, sign up → Workspace → New project → paste your novel → click **Start workflow**. DB is initialized on first run.

**Local dev** (with MySQL and Redis running):

```bash
cp .env.example .env
# Edit .env: DATABASE_URL, REDIS_HOST, etc.
npm install
npx prisma db push
npm run dev
```

Visit http://localhost:3000. Workers start together with `npm run dev`.

---

## 🔧 配置 · Configuration

**中文**  
启动后进入 **设置 → API 配置** 填写：

- **大语言模型**：剧本分析 / 分场 / 分镜 / 对白提取。推荐 [OpenRouter](https://openrouter.ai/) 或自建 OpenAI 兼容端点（Base URL + API Key）。
- **图像生成**：分镜图生成。OpenAI 兼容接口（如 DALL·E、自建 Stable Diffusion 等）。
- **语音合成**：配音。推荐 OpenAI 兼容 `/v1/audio/speech`（model: tts-1, voice: alloy）。
- **视频**：本版使用 FFmpeg 将分镜图与配音合成 MP4，无需单独视频生成 API；Docker 镜像已内置 FFmpeg。

所有密钥仅存于你的数据库与环境中，不上传第三方。

**English**  
After launch, go to **Settings → API configuration**:

- **LLM**: Script analysis, scene splitting, storyboard, dialogue extraction. Use [OpenRouter](https://openrouter.ai/) or any OpenAI-compatible endpoint (Base URL + API Key).
- **Image**: Panel image generation. Any OpenAI-compatible image API (e.g. DALL·E, self-hosted SD).
- **TTS**: Voiceover. OpenAI-compatible `/v1/audio/speech` (model: tts-1, voice: alloy) recommended.
- **Video**: This release uses FFmpeg to merge panels + audio into MP4; no separate video API. FFmpeg is included in the Docker image.

All keys stay in your DB and env; nothing is sent to third parties.

---

## 📋 流程 · Workflow

**中文**

1. **注册/登录** → **工作台** → **新建项目**
2. 进入项目 → 在「一键生成」框内**粘贴小说或剧本文本** → 点击 **启动工作流**
3. 工作流**自动按顺序执行**（无需再点下一步）：
   - 剧本分析 → 分场 → 分镜 → 出图 → 配音 → 视频合成
4. 结束后**刷新页面**，在项目页看到**集数**；进入某一集可查看**分场、分镜、出图、配音列表与成片播放**。

**English**

1. **Sign up / Log in** → **Workspace** → **New project**
2. Open the project → **Paste novel or script** in the one-click box → click **Start workflow**
3. The workflow **runs in order automatically** (no manual “next”):
   - Script analysis → Scene split → Storyboard → Images → Voiceover → Video composition
4. **Refresh** when done; see **episodes** on the project page. Open an episode to view **scenes, storyboard, images, voice list, and the final video player**.

---

## 🛠 技术栈 · Tech Stack

**中文**  
Next.js 15 · React 19 · MySQL · Prisma · Redis · BullMQ · Tailwind CSS v4 · NextAuth.js · next-intl（中英）

**English**  
Next.js 15 · React 19 · MySQL · Prisma · Redis · BullMQ · Tailwind CSS v4 · NextAuth.js · next-intl (i18n)

---

## 📁 项目结构 · Project Structure

```
FlintStudio/
├── prisma/schema.prisma      # 数据模型 · Data models (incl. GraphRun/GraphStep)
├── src/
│   ├── app/[locale]/         # 首页、工作台、项目、集详情、设置 · Pages
│   ├── app/api/              # 工作流、媒体、认证 · API routes
│   ├── lib/workflow/         # 工作流引擎、prompts、handlers · Workflow engine
│   ├── lib/generators/       # 图像、TTS 客户端 · Image & TTS clients
│   ├── lib/video/            # FFmpeg 成片合成 · Video composition
│   ├── lib/task/             # 队列与任务类型 · Queues & task types
│   └── lib/workers/          # BullMQ 四类 Worker · Four worker types
├── docker-compose.yml
├── Dockerfile                # 含 ffmpeg · Includes ffmpeg
└── FLINTSTUDIO_PLAN.md       # 详细规划 · Detailed plan
```

---

## 🌐 环境变量 · Environment Variables

**中文**  
详见 [.env.example](.env.example)。主要项：`DATABASE_URL`、`REDIS_HOST`/`REDIS_PORT`、`NEXTAUTH_URL`/`NEXTAUTH_SECRET`、`DATA_DIR`（配音与成片文件目录）、`INTERNAL_TASK_TOKEN`（Worker 推进工作流时使用的密钥）。

**English**  
See [.env.example](.env.example). Key vars: `DATABASE_URL`, `REDIS_HOST`/`REDIS_PORT`, `NEXTAUTH_URL`/`NEXTAUTH_SECRET`, `DATA_DIR` (voice & video output), `INTERNAL_TASK_TOKEN` (used by workers to advance the workflow).

---

## 📄 许可证 · License

**MIT** · See [LICENSE](LICENSE).


<p align="center">
  <strong>如果这个项目对你有帮助，欢迎 Star ⭐</strong><br />
  <strong>If this project helps you, give it a Star ⭐</strong>
</p>
