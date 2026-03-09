# 更新日志 · Changelog

本文档记录 FlintStudio 的版本更新内容。  
This file documents notable changes to FlintStudio.

---

## [Unreleased]

### 中文
1. **OpenClaw 远程控制**: 新增 `flintstudio-control` Skill，支持通过 Telegram/飞书等 IM 平台远程控制 FlintStudio
   - 创建项目、启动工作流、检查状态、获取结果
   - 提供 Telegram Bot 和飞书 Bot 完整示例代码
2. **OpenClaw API 端点**: 新增 7 个 REST API 端点供 OpenClaw 调用
   - `/api/openclaw/status` - 系统状态
   - `/api/openclaw/projects` - 项目管理
   - `/api/openclaw/projects/[id]/episodes` - 剧集管理
   - `/api/openclaw/workflow/run` - 启动工作流
   - `/api/openclaw/workflow/status/[runId]` - 查询状态
   - `/api/openclaw/config` - 配置管理
3. **文档清理**: 删除冗余文档，只保留 CHANGELOG.md 和 README.md

### English
1. **OpenClaw Remote Control**: Added `flintstudio-control` Skill for remote control via Telegram/Lark IM platforms
   - Create projects, start workflows, check status, get results
   - Complete Telegram Bot and Lark Bot examples included
2. **OpenClaw API Endpoints**: Added 7 REST API endpoints for OpenClaw integration
3. **Documentation Cleanup**: Removed redundant docs, keeping only CHANGELOG.md and README.md

---

## [Beta 0.20] - 2026-03-09

### 中文
1. **OpenClaw Skill 增强**: 新增完整的 AI 控制功能，支持通过 OpenClaw 龙虾 AI 部署、启动、停止、更新、备份 FlintStudio；新增 config、shell、clean、doctor、port、restart、restore 等命令
2. **API 中转支持**: 新增 Comfly 和云雾 API 中转服务支持，在 .env.example 中添加配置示例
3. **版本控制**: 项目进入 Beta 0.20 版本，建立版本发布流程
4. **系统 Prompt 全面优化**: 
   - OpenClaw Skill: 增强上下文记忆、风险预判、场景示例、持续学习能力
   - Workflow Prompts: 添加 Few-shot 示例、结构化输出、约束条件
   - 新增 `review-analysis.ts`: 复查分析专用 prompt，含评分细则、错误模式识别、改进建议模板
   - 新增 `analyze-novel.ts`: 剧本分析专用 prompt，含角色/场景提取、分集策略
5. **项目信息**: 在 README 底部添加 GitHub 仓库地址 https://github.com/flintcore/FlintStudio/ 和作者邮箱 qihuanteam@gmail.com
6. **README 优化**: 补充 OpenClaw Skill 完整命令列表、子 Agent 能力说明、项目结构更新

### English
1. **Enhanced OpenClaw Skill**: Added full AI control features for deploying, starting, stopping, updating, and backing up FlintStudio; new commands: config, shell, clean, doctor, port, restart, restore
2. **API Proxy Support**: Added support for Comfly and Yunwu API proxy services with configuration examples
3. **Version Control**: Project enters Beta 0.20 with established release process
4. **Comprehensive Prompt Optimization**:
   - OpenClaw Skill: Enhanced context memory, risk prediction, scenario examples, continuous learning
   - Workflow Prompts: Added Few-shot examples, structured output, constraint conditions
   - Added `review-analysis.ts`: Dedicated review analysis prompt with scoring criteria, error pattern recognition, improvement templates
   - Added `analyze-novel.ts`: Novel analysis prompt with character/scene extraction, episode strategy
5. **Project Info**: Added GitHub repository https://github.com/flintcore/FlintStudio/ and author email qihuanteam@gmail.com to README footer
6. **README Optimization**: Added complete OpenClaw Skill command list, sub-agent capabilities, updated project structure

---

### 中文
- **画风（视觉风格）**：一键成片前可选择画风（写实实拍、3D 虚幻 CG、漫剧、日式动画、3D 国漫、电影感、美漫等），分镜与出图将统一采用该风格；所选画风会保存为项目默认，下次自动回填。
- **API 对接**：统一 OpenAI 兼容路径（`/v1/chat/completions`、`/v1/images/generations`、`/v1/audio/speech`），Base URL 自动补 `/v1`；设置中支持为 LLM/图像/视频配置可选模型名，便于多模型、多端点对接。
- **多 Agent 与复查**：剧本分析完成后自动执行「复查 Agent」对集数/角色/场景做质检，结果写入步骤；运行详情展示每步简要结果（集数、复查通过/问题），避免黑盒。
- 初始开源版本：小说 → 剧本分析 → 分场 → 分镜 → 出图 → 配音 → 视频合成，全流程可配置 API。

### English
- **Visual style**: Before one-click run, you can select a visual style (e.g. live-action, Unreal CG, manhua, anime, 3D donghua, cinematic, American comic); storyboard and image generation will follow it. The choice is saved as the project default for next time.
- **API**: OpenAI-compatible paths with auto `/v1`; optional model names per type (LLM/image/video) in settings for multi-model and multi-endpoint support.
- **Multi-agent & review**: After script analysis, a review agent validates episodes/characters/locations; step results are stored and shown in run details (no black box).
- Initial release: novel → analysis → scene split → storyboard → images → voice → video; all APIs configurable.

---

格式说明 / Format: 版本号 [x.y.z] 下列出该版本的变更条目。  
Add new entries under `## [x.y.z] - YYYY-MM-DD` when releasing.
