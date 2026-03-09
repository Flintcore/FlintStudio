# 🎬 FlintStudio Deploy Skill for OpenClaw v1.1.0

> 一键部署和管理 FlintStudio AI 影视平台到 OpenClaw（龙虾 AI）
>
> **新版本特性**: 完整的程序控制功能、系统诊断、交互式配置、容器管理

[English Version](#english-version)

---

## 📖 简介

这个 Skill 让你在 OpenClaw（龙虾 AI）中直接部署和管理 FlintStudio，无需手动敲命令！

**v1.1.0 新功能：**
- 🛠️ **交互式配置** - 向导式配置 LLM、图像、TTS API
- 🔍 **系统诊断** - 自动检测问题并提供修复建议
- 🐚 **容器 Shell** - 直接进入容器执行高级操作
- 🧹 **资源清理** - 一键清理 Docker 缓存和无用资源
- 🔌 **端口管理** - 查看和修改服务端口配置
- 🔄 **智能重启** - 支持快速重启和完整重建

**适合人群：**
- 懒得记命令的小白用户
- 想快速体验 FlintStudio 的开发者
- 需要 AI 自动排查问题的用户
- 需要高级管理功能的运维人员

---

## 🚀 快速开始

### 方式一：直接对话部署（最简单）

安装好 OpenClaw 后，直接对它说：

```
安装 skill:flintstudio-deploy，然后帮我部署 FlintStudio
```

AI 会自动：
1. 安装这个 Skill
2. 检查系统环境
3. 克隆代码
4. 启动服务
5. 帮你配置 API 密钥
6. 告诉你访问地址

### 方式二：使用 Skill 命令

```bash
# 安装 Skill
openclaw skill install flintstudio-deploy

# 部署 FlintStudio
openclaw run flintstudio-deploy deploy

# 查看状态
openclaw run flintstudio-deploy status

# 查看日志
openclaw run flintstudio-deploy logs

# 配置 API 密钥
openclaw run flintstudio-deploy config

# 系统诊断
openclaw run flintstudio-deploy doctor

# 更新版本
openclaw run flintstudio-deploy update

# 备份数据
openclaw run flintstudio-deploy backup ~/my-backups

# 停止服务
openclaw run flintstudio-deploy stop
```

### 方式三：自然语言指令

安装 Skill 后，用自然语言告诉 AI 你要做什么：

| 你想做的事 | 对 AI 说的话 |
|-----------|-------------|
| 部署 | "帮我部署 FlintStudio" / "Deploy FlintStudio for me" |
| 启动 | "启动 FlintStudio" / "Start FlintStudio" |
| 停止 | "停止 FlintStudio" / "Stop FlintStudio" |
| 重启 | "重启 FlintStudio" / "Restart FlintStudio" |
| 更新 | "更新到最新版本" / "Update to latest" |
| 看日志 | "查看运行日志" / "Show me the logs" |
| 检查状态 | "检查运行状态" / "Check status" |
| 配置 API | "配置 API 密钥" / "Configure API keys" |
| 系统诊断 | "诊断系统问题" / "Diagnose system issues" |
| 进入容器 | "进入 FlintStudio 容器" / "Enter FlintStudio container" |
| 清理缓存 | "清理 Docker 缓存" / "Clean Docker cache" |
| 端口管理 | "查看端口配置" / "Show port configuration" |
| 备份 | "备份数据库" / "Backup database" |
| 恢复 | "从备份恢复" / "Restore from backup" |
| 重置 | "重置所有数据" / "Reset all data" |

---

## 📋 详细命令说明

### `deploy` - 完整部署

首次部署使用此命令，会自动完成：
- 检查 Docker、Git 是否安装
- 检查端口占用（自动寻找可用端口）
- 克隆 GitHub 代码
- 配置环境变量
- 启动 Docker Compose
- 验证部署状态

**参数：**
- `--mirror=cn` - 使用国内镜像（适合国内网络）
- `--mirror=global` - 使用全球镜像
- `path` - 自定义安装路径

**示例：**
```bash
# 使用国内镜像部署
openclaw run flintstudio-deploy deploy --mirror=cn

# 部署到自定义路径
openclaw run flintstudio-deploy deploy /opt/flintstudio
```

---

### `start` - 启动服务

启动已部署的 FlintStudio：
```bash
openclaw run flintstudio-deploy start
```

---

### `stop` - 停止服务

停止 FlintStudio：
```bash
openclaw run flintstudio-deploy stop
```

---

### `restart` - 重启服务 ⭐新增

重启 FlintStudio，支持两种模式：

**快速重启**（不重建容器，速度快）：
```bash
openclaw run flintstudio-deploy restart --quick
```

**完整重启**（重新构建并启动）：
```bash
openclaw run flintstudio-deploy restart
```

---

### `config` - 配置 API 密钥 ⭐新增

交互式配置各类 API 密钥：

```bash
# 配置所有 API
openclaw run flintstudio-deploy config

# 仅配置 LLM API
openclaw run flintstudio-deploy config --type=llm

# 仅配置图像 API
openclaw run flintstudio-deploy config --type=image

# 仅配置 TTS API
openclaw run flintstudio-deploy config --type=tts

# 显示当前配置
openclaw run flintstudio-deploy config --show
```

**支持的 LLM 服务商：**
- OpenAI (GPT-4, GPT-3.5)
- Azure OpenAI
- Anthropic Claude
- Google Gemini
- DeepSeek (国内)
- 月之暗面 Moonshot (国内)
- 智谱 AI GLM (国内)

**支持的图像服务商：**
- OpenAI DALL-E
- Stability AI
- 通义万相 (阿里云)
- 文心一格 (百度)

**支持的 TTS 服务商：**
- OpenAI TTS
- Azure TTS
- ElevenLabs
- 讯飞语音
- 阿里云语音

---

### `shell` - 进入容器 Shell ⭐新增

进入 FlintStudio 容器执行高级操作：

```bash
# 进入应用容器（默认）
openclaw run flintstudio-deploy shell

# 进入 MySQL 容器
openclaw run flintstudio-deploy shell mysql

# 进入 Redis 容器
openclaw run flintstudio-deploy shell redis
```

进入容器后，你可以：
- 查看详细日志文件
- 执行数据库命令
- 调试应用程序
- 修改配置文件

**退出容器**：输入 `exit` 或按 `Ctrl+D`

---

### `clean` - 清理 Docker 资源 ⭐新增

清理 Docker 缓存和无用资源：

```bash
# 基础清理（推荐）
openclaw run flintstudio-deploy clean

# 深度清理（包括卷，⚠️ 危险）
openclaw run flintstudio-deploy clean --all

# 模拟运行（查看会清理什么）
openclaw run flintstudio-deploy clean --dry-run
```

**清理内容：**
- 停止的容器
- 未使用的镜像
- 未使用的网络
- 构建缓存
- （深度清理）未使用的卷

---

### `doctor` - 系统诊断 ⭐新增

诊断系统问题并给出修复建议：

```bash
# 基础诊断
openclaw run flintstudio-deploy doctor

# 完整诊断（包括性能检查）
openclaw run flintstudio-deploy doctor --full

# 自动修复发现的问题
openclaw run flintstudio-deploy doctor --fix
```

**诊断项目：**
- ✅ Docker 环境检查
- ✅ 安装目录完整性
- ✅ 端口占用情况
- ✅ 容器运行状态
- ✅ 磁盘空间检查
- ✅ 内存使用情况
- ✅ 日志文件分析

---

### `port` - 端口管理 ⭐新增

查看和修改端口配置：

```bash
# 列出当前端口配置
openclaw run flintstudio-deploy port list

# 检查端口占用
openclaw run flintstudio-deploy port check

# 修改服务端口
openclaw run flintstudio-deploy port change app 8080
openclaw run flintstudio-deploy port change mysql 13307
```

**默认端口：**
| 服务 | 内部端口 | 外部端口 | 说明 |
|------|---------|---------|------|
| app | 3000 | 13000 | Web 服务 |
| mysql | 3306 | 13306 | 数据库 |
| redis | 6379 | 16379 | 缓存 |

---

### `update` - 更新版本

拉取最新代码并重新部署：

```bash
# 正常更新
openclaw run flintstudio-deploy update

# 强制更新（丢弃本地修改）
openclaw run flintstudio-deploy update --force
```

---

### `logs [service]` - 查看日志

查看运行日志：

```bash
# 查看应用日志（默认100行）
openclaw run flintstudio-deploy logs

# 查看指定服务日志
openclaw run flintstudio-deploy logs mysql

# 查看所有服务日志
openclaw run flintstudio-deploy logs all

# 查看指定行数
openclaw run flintstudio-deploy logs app --lines=500
```

**按 `Ctrl+C` 退出日志查看**

---

### `status` - 检查状态

查看所有服务的运行状态：

```bash
# 基础状态
openclaw run flintstudio-deploy status

# 详细状态（包括资源使用）
openclaw run flintstudio-deploy status --verbose
```

---

### `backup [path]` - 备份数据

备份 MySQL 数据库：

```bash
# 备份到默认路径
openclaw run flintstudio-deploy backup

# 备份到指定路径
openclaw run flintstudio-deploy backup ~/my-backups
```

---

### `restore <file>` - 恢复备份 ⭐新增

从备份恢复数据库：

```bash
# 恢复备份（需要确认）
openclaw run flintstudio-deploy restore ~/backups/flintstudio-backup.sql

# 强制恢复（跳过确认）
openclaw run flintstudio-deploy restore ~/backups/flintstudio-backup.sql --force
```

**⚠️ 警告：恢复将覆盖现有数据！**

---

### `reset yes` - 重置数据 ⚠️

**危险操作！** 会删除所有数据，重新初始化：

```bash
# 重置数据但保留镜像
openclaw run flintstudio-deploy reset yes

# 完全重置（包括镜像）
openclaw run flintstudio-deploy reset yes --no-keep-images
```

---

## 🔧 故障排查

### AI 自动修复的问题

部署过程中，AI 会自动尝试修复以下问题：
- ✅ Docker 未安装 → 提示安装方法
- ✅ Docker 未运行 → 提示启动方法
- ✅ 端口被占用 → 自动检测并建议可用端口
- ✅ 依赖下载失败 → 自动重试或切换镜像源
- ✅ 权限不足 → 自动使用 sudo
- ✅ 代码更新失败 → 尝试清理后重试

### 使用 Doctor 命令诊断

遇到问题时，首先运行诊断：

```bash
# 基础诊断
openclaw run flintstudio-deploy doctor

# 诊断并自动修复
openclaw run flintstudio-deploy doctor --fix

# 完整诊断
openclaw run flintstudio-deploy doctor --full
```

### 手动排查

如果 AI 无法自动修复，可以尝试：

```bash
# 1. 查看详细日志
openclaw run flintstudio-deploy logs

# 2. 进入容器检查
openclaw run flintstudio-deploy shell

# 3. 清理后重启
openclaw run flintstudio-deploy clean
openclaw run flintstudio-deploy restart

# 4. 完全重置后重新部署
openclaw run flintstudio-deploy stop
openclaw run flintstudio-deploy reset yes
openclaw run flintstudio-deploy deploy
```

---

## 📁 文件结构

```
skills/flintstudio-deploy/
├── skill.json          # Skill 配置信息
├── deploy.ts           # 部署脚本（TypeScript）
├── package.json        # Node.js 包配置
├── README.md           # 本文件
└── install.sh          # 安装脚本
```

---

## ⚙️ 配置说明

### 配置文件位置

- **环境变量**: `~/FlintStudio/.env`
- **Docker Compose**: `~/FlintStudio/docker-compose.yml`

### 主要配置项

| 配置项 | 说明 | 示例 |
|-------|------|------|
| `OPENAI_API_KEY` | LLM API 密钥 | sk-xxx... |
| `OPENAI_BASE_URL` | API 基础地址 | https://api.openai.com/v1 |
| `LLM_MODEL` | 默认模型 | gpt-4 |
| `IMAGE_API_KEY` | 图像生成 API 密钥 | sk-xxx... |
| `TTS_API_KEY` | 语音合成 API 密钥 | sk-xxx... |

### 配置方式

1. **推荐**: 使用 `config` 命令交互式配置
2. **手动**: 编辑 `.env` 文件
3. **Web**: 通过 FlintStudio 网页端的「设置」页面

---

## 🌐 访问地址

部署成功后：
- **本地访问**: http://localhost:13000
- **局域网访问**: http://你的IP:13000

修改端口：
```bash
openclaw run flintstudio-deploy port change app 8080
openclaw run flintstudio-deploy restart
```

---

## 📝 卸载

如需卸载 FlintStudio：

```bash
# 停止服务
openclaw run flintstudio-deploy stop

# 删除数据（可选）
openclaw run flintstudio-deploy reset yes

# 卸载 Skill
openclaw skill uninstall flintstudio-deploy
```

然后手动删除安装目录（默认 `~/FlintStudio`）

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

This Skill allows you to deploy and manage FlintStudio directly in OpenClaw without typing commands manually!

**v1.1.0 New Features:**
- 🛠️ **Interactive Config** - Wizard-style API configuration
- 🔍 **System Doctor** - Auto-diagnose and fix issues
- 🐚 **Container Shell** - Direct container access
- 🧹 **Resource Cleanup** - One-click Docker cleanup
- 🔌 **Port Management** - View and modify service ports
- 🔄 **Smart Restart** - Quick and full restart modes

## 🚀 Quick Start

### Method 1: Conversational Deployment (Easiest)

After installing OpenClaw, just tell it:

```
Install skill:flintstudio-deploy and deploy FlintStudio for me
```

### Method 2: Use Skill Commands

```bash
# Install Skill
openclaw skill install flintstudio-deploy

# Deploy FlintStudio
openclaw run flintstudio-deploy deploy

# System diagnosis
openclaw run flintstudio-deploy doctor

# Configure API keys
openclaw run flintstudio-deploy config

# Enter container shell
openclaw run flintstudio-deploy shell
```

### Method 3: Natural Language

| What You Want | What to Say |
|--------------|-------------|
| Deploy | "Deploy FlintStudio for me" |
| Start | "Start FlintStudio" |
| Stop | "Stop FlintStudio" |
| Restart | "Restart FlintStudio" |
| Update | "Update to latest version" |
| View logs | "Show me the logs" |
| Check status | "Check status" |
| Configure API | "Configure API keys" |
| Diagnose | "Diagnose system issues" |
| Enter shell | "Enter FlintStudio container" |
| Clean cache | "Clean Docker cache" |
| Port config | "Show port configuration" |
| Backup | "Backup database" |
| Restore | "Restore from backup" |
| Reset | "Reset all data" |

## 📋 Command Reference

### New Commands in v1.1.0

#### `config` - Configure API Keys

```bash
# Configure all APIs interactively
openclaw run flintstudio-deploy config

# Configure specific API type
openclaw run flintstudio-deploy config --type=llm
openclaw run flintstudio-deploy config --type=image
openclaw run flintstudio-deploy config --type=tts

# Show current config
openclaw run flintstudio-deploy config --show
```

#### `shell` - Enter Container Shell

```bash
# Enter app container
openclaw run flintstudio-deploy shell

# Enter MySQL container
openclaw run flintstudio-deploy shell mysql

# Enter Redis container
openclaw run flintstudio-deploy shell redis
```

#### `clean` - Clean Docker Resources

```bash
# Basic cleanup
openclaw run flintstudio-deploy clean

# Deep clean (includes volumes)
openclaw run flintstudio-deploy clean --all

# Dry run
openclaw run flintstudio-deploy clean --dry-run
```

#### `doctor` - System Diagnosis

```bash
# Basic diagnosis
openclaw run flintstudio-deploy doctor

# Full diagnosis
openclaw run flintstudio-deploy doctor --full

# Auto-fix issues
openclaw run flintstudio-deploy doctor --fix
```

#### `port` - Port Management

```bash
# List port configuration
openclaw run flintstudio-deploy port list

# Check port availability
openclaw run flintstudio-deploy port check

# Change service port
openclaw run flintstudio-deploy port change app 8080
```

#### `restart` - Restart Service

```bash
# Quick restart
openclaw run flintstudio-deploy restart --quick

# Full restart (rebuild)
openclaw run flintstudio-deploy restart
```

#### `restore` - Restore from Backup

```bash
# Restore backup
openclaw run flintstudio-deploy restore ~/backups/backup.sql --force
```

## 🔧 Troubleshooting

### Use Doctor Command

```bash
# Diagnose and auto-fix
openclaw run flintstudio-deploy doctor --fix --full
```

### Common Issues

- Docker not installed → Provides install instructions
- Port occupied → Auto-detects available ports
- Container won't start → Check logs with `logs` command
- Database connection failed → Check MySQL container status
- API calls failing → Verify API keys with `config --show`
- Disk space full → Run `clean` command
- Memory issues → Close other services or increase swap

## 🌐 Access URL

After successful deployment:
- **Local**: http://localhost:13000
- **LAN**: http://your-ip:13000

## 📄 License

MIT License
