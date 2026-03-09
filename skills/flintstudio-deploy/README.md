# 🎬 FlintStudio Deploy Skill for OpenClaw

> 一键部署 FlintStudio AI 影视平台到 OpenClaw（龙虾 AI）

[English Version](#english-version)

---

## 📖 简介

这个 Skill 让你在 OpenClaw（龙虾 AI）中直接部署和管理 FlintStudio，无需手动敲命令！

**适合人群：**
- 懒得记命令的小白用户
- 想快速体验 FlintStudio 的开发者
- 需要 AI 自动排查问题的用户

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
5. 告诉你访问地址

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
| 更新 | "更新到最新版本" / "Update to latest" |
| 看日志 | "查看运行日志" / "Show me the logs" |
| 检查状态 | "检查运行状态" / "Check status" |
| 备份 | "备份数据库" / "Backup database" |
| 重置 | "重置所有数据" / "Reset all data" |

## 📋 详细命令说明

### `deploy` - 完整部署

首次部署使用此命令，会自动完成：
- 检查 Docker、Git 是否安装
- 检查端口占用
- 克隆 GitHub 代码
- 配置环境变量
- 启动 Docker Compose
- 验证部署状态

**参数：**
- `--mirror=cn` - 使用国内镜像（适合国内网络）
- `--path=/custom/path` - 自定义安装路径

**示例：**
```bash
openclaw run flintstudio-deploy deploy --mirror=cn
```

### `start` - 启动服务

启动已部署的 FlintStudio：
```bash
openclaw run flintstudio-deploy start
```

### `stop` - 停止服务

停止 FlintStudio：
```bash
openclaw run flintstudio-deploy stop
```

### `update` - 更新版本

拉取最新代码并重新部署：
```bash
openclaw run flintstudio-deploy update
```

### `logs [service]` - 查看日志

查看运行日志：
```bash
# 查看应用日志（默认）
openclaw run flintstudio-deploy logs

# 查看 MySQL 日志
openclaw run flintstudio-deploy logs mysql

# 查看 Redis 日志
openclaw run flintstudio-deploy logs redis
```

### `status` - 检查状态

查看所有服务的运行状态：
```bash
openclaw run flintstudio-deploy status
```

### `backup [path]` - 备份数据

备份 MySQL 数据库：
```bash
# 备份到默认路径
openclaw run flintstudio-deploy backup

# 备份到指定路径
openclaw run flintstudio-deploy backup ~/my-backups
```

### `reset yes` - 重置数据 ⚠️

**危险操作！** 会删除所有数据，重新初始化：
```bash
openclaw run flintstudio-deploy reset yes
```

## 🔧 故障排查

### AI 自动修复的问题

部署过程中，AI 会自动尝试修复以下问题：
- ✅ Docker 未安装 → 提示安装方法
- ✅ 端口被占用 → 自动检测并建议解决方案
- ✅ 依赖下载失败 → 自动重试或切换镜像源
- ✅ 权限不足 → 自动使用 sudo
- ✅ 代码更新失败 → 尝试清理后重试

### 手动排查

如果 AI 无法自动修复，可以尝试：

```bash
# 1. 查看详细日志
openclaw run flintstudio-deploy logs

# 2. 重启 Docker 服务
openclaw run flintstudio-deploy stop
openclaw run flintstudio-deploy start

# 3. 完全重置后重新部署
openclaw run flintstudio-deploy stop
openclaw run flintstudio-deploy reset yes
openclaw run flintstudio-deploy deploy
```

## 📁 文件结构

```
skills/flintstudio-deploy/
├── skill.json          # Skill 配置信息
├── deploy.ts           # 部署脚本（TypeScript）
└── README.md           # 本文件
```

## ⚙️ 配置说明

部署后，配置文件位于 `~/.env`，主要配置项：

| 配置项 | 说明 | 示例 |
|-------|------|------|
| `OPENAI_API_KEY` | LLM API 密钥 | sk-xxx... |
| `OPENAI_BASE_URL` | API 基础地址 | https://api.openai.com/v1 |
| `IMAGE_API_KEY` | 图像生成 API 密钥 | sk-xxx... |
| `TTS_API_KEY` | 语音合成 API 密钥 | sk-xxx... |

**配置方式：**
1. 直接编辑 `.env` 文件
2. 或通过 FlintStudio 网页端的「设置」页面配置

## 🌐 访问地址

部署成功后：
- **本地访问**: http://localhost:13000
- **局域网访问**: http://你的IP:13000

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

## 🤝 贡献

欢迎提交 Issue 和 PR！

- 项目主页：https://github.com/Flintcore/FlintStudio
- 问题反馈：https://github.com/Flintcore/FlintStudio/issues

## 📄 License

MIT License

---

# English Version

## 📖 Introduction

This Skill allows you to deploy and manage FlintStudio directly in OpenClaw without typing commands manually!

**For:**
- Users who don't want to remember commands
- Developers who want to quickly try FlintStudio
- Users who need AI auto-debugging

## 🚀 Quick Start

### Method 1: Conversational Deployment (Easiest)

After installing OpenClaw, just tell it:

```
Install skill:flintstudio-deploy and deploy FlintStudio for me
```

The AI will automatically:
1. Install this Skill
2. Check system environment
3. Clone the code
4. Start services
5. Tell you the access URL

### Method 2: Use Skill Commands

```bash
# Install Skill
openclaw skill install flintstudio-deploy

# Deploy FlintStudio
openclaw run flintstudio-deploy deploy

# Check status
openclaw run flintstudio-deploy status

# View logs
openclaw run flintstudio-deploy logs

# Update version
openclaw run flintstudio-deploy update

# Backup data
openclaw run flintstudio-deploy backup ~/my-backups

# Stop service
openclaw run flintstudio-deploy stop
```

### Method 3: Natural Language

After installing the Skill, use natural language:

| What You Want | What to Say |
|--------------|-------------|
| Deploy | "Deploy FlintStudio for me" |
| Start | "Start FlintStudio" |
| Stop | "Stop FlintStudio" |
| Update | "Update to latest version" |
| View logs | "Show me the logs" |
| Check status | "Check status" |
| Backup | "Backup database" |
| Reset | "Reset all data" |

## 📋 Command Reference

### `deploy` - Full Deployment

Use this for first-time deployment. Automatically:
- Check if Docker and Git are installed
- Check port availability
- Clone GitHub code
- Configure environment variables
- Start Docker Compose
- Verify deployment status

**Parameters:**
- `--mirror=cn` - Use China mirror (for users in China)
- `--path=/custom/path` - Custom installation path

**Example:**
```bash
openclaw run flintstudio-deploy deploy --mirror=cn
```

### Other Commands

Same as Chinese version above.

## 🔧 Troubleshooting

The AI will automatically try to fix:
- ✅ Docker not installed
- ✅ Port occupied
- ✅ Dependency download failed
- ✅ Permission denied
- ✅ Git pull failed

## 🌐 Access URL

After successful deployment:
- **Local**: http://localhost:13000
- **LAN**: http://your-ip:13000

## 📄 License

MIT License
