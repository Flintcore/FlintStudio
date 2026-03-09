# 🎮 FlintStudio Control Skill for OpenClaw

> 通过 Telegram/飞书等 IM 平台控制 FlintStudio AI 影视平台的核心业务功能

[English Version](#english-version)

---

## 📖 简介

这个 Skill 让你可以通过 IM 平台（如 Telegram、飞书）直接控制 FlintStudio，无需打开 Web 界面即可完成：

- 📁 项目管理（创建、查看、删除）
- 🎬 工作流控制（启动、监控、继续）
- 📊 状态检查（实时查看生成进度）
- 🎨 配置管理（API 密钥配置）
- 📥 结果获取（查看生成的视频）

**适用场景：**
- 移动端随时查看项目进度
- 团队协作时快速检查状态
- 自动化任务集成
- 远程管理 FlintStudio 实例

---

## 🚀 快速开始

### 方式一：直接对话（最简单）

安装好 OpenClaw 后，直接对它说：

```
安装 skill:flintstudio-control，然后帮我连接 FlintStudio
```

AI 会自动：
1. 安装这个 Skill
2. 测试与 FlintStudio 的连接
3. 引导你配置 API
4. 展示可用命令

### 方式二：使用 Skill 命令

```bash
# 安装 Skill
openclaw skill install flintstudio-control

# 测试连接
openclaw run flintstudio-control test-connection

# 显示帮助
openclaw run flintstudio-control help

# 配置 API
openclaw run flintstudio-control configure-api

# 创建项目
openclaw run flintstudio-control create-project 我的小说改编

# 启动工作流
openclaw run flintstudio-control start-workflow <项目ID> "小说内容..." live_action

# 查看状态
openclaw run flintstudio-control list-workflows

# 检查特定工作流
openclaw run flintstudio-control check-status <运行ID>
```

### 方式三：自然语言指令

| 你想做的事 | 对 AI 说的话 |
|-----------|-------------|
| 连接测试 | "测试 FlintStudio 连接" / "Test connection" |
| 查看帮助 | "显示帮助" / "Show help" |
| 创建项目 | "创建项目 我的小说" / "Create project My Novel" |
| 查看项目 | "列出所有项目" / "List projects" |
| 删除项目 | "删除项目 xxx" / "Delete project xxx" |
| 启动生成 | "启动工作流 xxx 内容是..." / "Start workflow xxx with text..." |
| 查看进度 | "查看工作流列表" / "List workflows" |
| 检查状态 | "检查状态 xxx" / "Check status xxx" |
| 继续工作流 | "继续工作流 xxx" / "Continue workflow xxx" |
| 查看结果 | "获取结果 xxx 第1集" / "Get result xxx episode 1" |
| 配置 API | "配置 API" / "Configure API" |
| 查看配置 | "查看当前配置" / "Show config" |
| 设置服务器 | "设置服务器 http://xxx" / "Set server http://xxx" |

---

## 📋 命令详解

### `test-connection` - 测试连接

测试与 FlintStudio 服务器的连接：

```bash
openclaw run flintstudio-control test-connection
```

**默认地址**: http://localhost:13000

---

### `set-server <url>` - 设置服务器

设置 FlintStudio 服务器地址（支持远程服务器）：

```bash
# 本地服务器
openclaw run flintstudio-control set-server http://localhost:13000

# 远程服务器
openclaw run flintstudio-control set-server http://192.168.1.100:13000

# 域名
openclaw run flintstudio-control set-server https://flintstudio.example.com
```

---

### `help` - 显示帮助

显示所有可用命令：

```bash
openclaw run flintstudio-control help
```

---

### `create-project [name]` - 创建项目

创建新项目：

```bash
# 使用默认名称（当前日期）
openclaw run flintstudio-control create-project

# 指定名称
openclaw run flintstudio-control create-project 我的小说改编
```

**注意**: 当前版本建议通过 Web 界面创建项目。

---

### `list-projects [limit]` - 列出项目

查看所有项目：

```bash
# 默认返回 20 个
openclaw run flintstudio-control list-projects

# 指定数量
openclaw run flintstudio-control list-projects 50
```

---

### `delete-project <projectId>` - 删除项目

删除指定项目（⚠️ 不可恢复）：

```bash
openclaw run flintstudio-control delete-project proj_xxx
```

---

### `start-workflow <projectId> <novelText> [visualStyle]` - 启动工作流

一键启动视频生成工作流：

```bash
# 基础用法
openclaw run flintstudio-control start-workflow proj_xxx "第一章 内容..."

# 指定画风
openclaw run flintstudio-control start-workflow proj_xxx "第一章 内容..." live_action

# 长文本（从文件读取）
openclaw run flintstudio-control start-workflow proj_xxx "$(cat novel.txt)" anime
```

**画风选项**:
- `default` - 默认（AI 自由发挥）
- `live_action` - 写实实拍
- `unreal_cg` - 3D 虚幻引擎游戏 CG
- `manhua` - 漫剧 / 条漫
- `anime` - 日式动画
- `donghua_3d` - 3D 国漫 / 修仙
- `cinematic` - 电影感（通用）
- `american_comic` - 美漫 / 美式漫画

**限制**: 小说文本最多 10 万字符

---

### `create-episode <projectId> <novelText> [visualStyle]` - 创建剧集

与 `start-workflow` 相同，用于创建新剧集：

```bash
openclaw run flintstudio-control create-episode proj_xxx "第二章 内容..." manhua
```

---

### `list-workflows [projectId] [status] [limit]` - 列出工作流

查看工作流运行记录：

```bash
# 查看所有
openclaw run flintstudio-control list-workflows

# 筛选特定项目
openclaw run flintstudio-control list-workflows proj_xxx

# 筛选特定状态
openclaw run flintstudio-control list-workflows "" running

# 查看最近 10 个
openclaw run flintstudio-control list-workflows "" "" 10
```

**状态选项**: `queued`, `running`, `completed`, `failed`, `canceled`

---

### `check-status <runId>` - 检查状态

查看工作流运行的详细状态：

```bash
openclaw run flintstudio-control check-status run_xxx
```

输出信息包括：
- 当前状态
- 执行阶段
- 各步骤进度
- 错误信息（如有）
- 操作建议

---

### `continue-workflow <runId>` - 继续工作流

当工作流停在 "review_failed" 阶段时，确认后继续执行：

```bash
openclaw run flintstudio-control continue-workflow run_xxx
```

---

### `retry-analyze <runId>` - 重试分析

重新执行剧本分析步骤：

```bash
openclaw run flintstudio-control retry-analyze run_xxx
```

---

### `get-result <projectId> <episodeNumber>` - 获取结果

获取生成的剧集信息和下载链接：

```bash
# 获取第 1 集结果
openclaw run flintstudio-control get-result proj_xxx 1

# 获取第 2 集结果
openclaw run flintstudio-control get-result proj_xxx 2
```

---

### `configure-api [type]` - 配置 API

交互式配置 API 密钥：

```bash
# 配置所有 API
openclaw run flintstudio-control configure-api

# 仅配置 LLM
openclaw run flintstudio-control configure-api llm

# 仅配置图像
openclaw run flintstudio-control configure-api image

# 仅配置 TTS
openclaw run flintstudio-control configure-api tts
```

**支持的 API 服务商**:

**LLM（大语言模型）**:
- OpenAI (GPT-4, GPT-3.5)
- Azure OpenAI
- Anthropic Claude
- Google Gemini
- OpenRouter
- DeepSeek (国内)
- 月之暗面 Moonshot (国内)
- 智谱 AI GLM (国内)

**图像生成**:
- OpenAI DALL-E
- 通义万相 (阿里云)
- 文心一格 (百度)
- Stability AI

**TTS（语音合成）**:
- OpenAI TTS
- Azure TTS
- ElevenLabs
- 讯飞语音
- 阿里云语音

---

### `get-config` - 查看配置

查看当前 API 配置（API Key 会被隐藏）：

```bash
openclaw run flintstudio-control get-config
```

---

## 🔄 工作流程示例

### 完整的工作流程

```bash
# 1. 测试连接
openclaw run flintstudio-control test-connection

# 2. 配置 API（首次使用）
openclaw run flintstudio-control configure-api all

# 3. 创建项目（或通过 Web 界面创建）
# 访问 http://localhost:13000/workspace 创建项目

# 4. 启动工作流
openclaw run flintstudio-control start-workflow \
  "proj_xxxxx" \
  "第一章 夜幕降临，小明走在回家的路上..." \
  "live_action"

# 5. 查看工作流列表，获取运行ID
openclaw run flintstudio-control list-workflows

# 6. 检查状态
openclaw run flintstudio-control check-status "run_xxxxx"

# 7. 等待完成后获取结果
openclaw run flintstudio-control get-result "proj_xxxxx" 1
```

---

## 🎨 画风说明

| 画风 | 说明 | 适用场景 |
|------|------|----------|
| `default` | AI 自由发挥 | 不确定风格时 |
| `live_action` | 写实实拍，真人电影质感 | 真人短剧 |
| `unreal_cg` | 3D 虚幻引擎 CG | 游戏宣传 |
| `manhua` | 漫剧/条漫风格 | 漫画改编 |
| `anime` | 日式动画 | 动漫风格 |
| `donghua_3d` | 3D 国漫/修仙 | 仙侠题材 |
| `cinematic` | 电影感通用 | 电影短片 |
| `american_comic` | 美漫风格 | 超级英雄题材 |

---

## 📊 工作流状态说明

| 状态 | 含义 | 操作建议 |
|------|------|----------|
| `queued` | 排队中 | 等待系统资源 |
| `running` | 运行中 | 正常执行，可刷新查看进度 |
| `completed` | 已完成 | 可以获取结果 |
| `failed` | 失败 | 查看错误信息，修复后重试 |
| `canceled` | 已取消 | 被用户或系统取消 |

---

## 🔧 故障排查

### 连接失败

```bash
# 测试连接
openclaw run flintstudio-control test-connection

# 如果失败，检查：
# 1. FlintStudio 是否已启动
# 2. 服务器地址是否正确
# 3. 网络连接是否正常

# 设置正确的服务器地址
openclaw run flintstudio-control set-server http://your-server:13000
```

### API 配置错误

```bash
# 查看当前配置
openclaw run flintstudio-control get-config

# 重新配置
openclaw run flintstudio-control configure-api all
```

### 工作流失败

```bash
# 查看详细错误
openclaw run flintstudio-control check-status <runId>

# 如果是分析失败，重试
openclaw run flintstudio-control retry-analyze <runId>

# 如果是复查暂停，确认后继续
openclaw run flintstudio-control continue-workflow <runId>
```

---

## 🌐 远程控制

### 内网穿透

如果你想从外网控制家里的 FlintStudio：

```bash
# 使用 ngrok 等工具
ngrok http 13000

# 设置远程地址
openclaw run flintstudio-control set-server https://xxxx.ngrok.io
```

### 服务器部署

```bash
# 在服务器上部署 FlintStudio 后
openclaw run flintstudio-control set-server https://flintstudio.yourdomain.com

# 测试连接
openclaw run flintstudio-control test-connection
```

---

## 📁 文件结构

```
skills/flintstudio-control/
├── skill.json          # Skill 配置文件
├── api-client.ts       # API 客户端封装
├── control.ts          # 核心控制逻辑
└── README.md           # 本文档
```

---

## 🔐 安全提示

1. **API Key 安全**: API Key 存储在 FlintStudio 服务器上，不会发送到 IM 平台
2. **服务器访问**: 建议通过 HTTPS 访问远程服务器
3. **认证**: 如果 FlintStudio 启用了认证，需要配置相应的 token
4. **敏感操作**: 删除项目等操作不可逆，请谨慎操作

---

## 🤝 贡献

欢迎提交 Issue 和 PR！

- 项目主页：https://github.com/Flintcore/FlintStudio
- 问题反馈：https://github.com/Flintcore/FlintStudio/issues

---

## 📄 License

MIT License

---

# English Version

## 📖 Introduction

This Skill allows you to control FlintStudio core functions via IM platforms (Telegram, Lark, etc.):

- 📁 Project management (create, view, delete)
- 🎬 Workflow control (start, monitor, continue)
- 📊 Status checking (real-time generation progress)
- 🎨 Configuration management (API keys)
- 📥 Results retrieval (view generated videos)

---

## 🚀 Quick Start

### Method 1: Conversational

After installing OpenClaw, just tell it:

```
Install skill:flintstudio-control and help me connect to FlintStudio
```

### Method 2: Commands

```bash
# Install
openclaw skill install flintstudio-control

# Test connection
openclaw run flintstudio-control test-connection

# Show help
openclaw run flintstudio-control help

# Create project
openclaw run flintstudio-control create-project "My Novel"

# Start workflow
openclaw run flintstudio-control start-workflow <projectId> "Novel text..." live_action

# Check status
openclaw run flintstudio-control check-status <runId>
```

---

## 📋 Command Reference

| Command | Description |
|---------|-------------|
| `test-connection` | Test server connection |
| `set-server <url>` | Set server address |
| `help` | Show help |
| `create-project [name]` | Create new project |
| `list-projects [limit]` | List all projects |
| `delete-project <id>` | Delete project |
| `start-workflow <id> <text> [style]` | Start generation |
| `list-workflows [filters]` | List workflow runs |
| `check-status <runId>` | Check run status |
| `continue-workflow <runId>` | Continue paused workflow |
| `retry-analyze <runId>` | Retry analysis step |
| `get-result <id> <episode>` | Get episode results |
| `configure-api [type]` | Configure API keys |
| `get-config` | View current config |

---

## 🎨 Visual Styles

| Style | Description |
|-------|-------------|
| `default` | AI decides |
| `live_action` | Live-action film |
| `unreal_cg` | Unreal Engine CG |
| `manhua` | Manhua/Webtoon |
| `anime` | Anime style |
| `donghua_3d` | Chinese 3D animation |
| `cinematic` | Cinematic general |
| `american_comic` | American comic |

---

## 📄 License

MIT License
