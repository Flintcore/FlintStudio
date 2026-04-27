# 更新日志 · Changelog

本文档记录 FlintStudio 的版本更新内容。  
This file documents notable changes to FlintStudio.

---

## [Unreleased]

### Added (2026-04-27)

- **Global Search** - Project/episode/character/location search with Cmd+K shortcut
- **PWA Support** - Service Worker for offline support and resource caching
- **Build Optimizations** - Security headers, long-term caching, image optimization
- **Database Monitoring** - Query metrics, health checks, connection monitoring
- **Core Web Vitals** - LCP, FID, CLS, FCP, TTFB tracking and logging
- **Error Boundaries** - React error boundaries with retry functionality
- **API Client** - Unified API client with retry, timeout, and error handling
- **Cache Integration** - Redis/Memory cache applied to workspace pages

## [0.56.0] - 2026-04-26

### Added

#### Week 1: Feature & Observability

- **Seedance 2.0 Video API Integration**
  - `src/lib/generators/video-client.ts` - Full API client for video generation
  - Support for text-to-video and image-to-video generation
  - Async polling mechanism with configurable timeout
  - Exponential backoff retry logic
  - Default video model set to "seedance-v2"

- **Runtime Log Viewer**
  - `src/lib/log-buffer.ts` - In-memory log storage (1000 entries)
  - `src/app/api/logs/route.ts` - REST API for log retrieval
  - `src/app/[locale]/settings/log-viewer.tsx` - Real-time log viewer UI
  - Log statistics (total, errors, warnings, tasks)
  - Filtering by level and type
  - Expandable JSON context
  - Auto-refresh with 5-second intervals

#### Week 2: Performance & Caching

- **Redis/Memory Cache Layer**
  - `src/lib/cache.ts` - Dual-mode cache (Redis with memory fallback)
  - `src/lib/cache-wrapper.ts` - High-level cache utilities
  - Cache helpers for users, projects, episodes, workflows

- **Performance Hooks**
  - `src/lib/hooks/use-performance.ts`
  - `useRenderPerformance` - Component render tracking
  - `useDebounce`, `useThrottle` - Event optimization
  - `useVirtualList` - Large list virtualization

#### Week 3: API Reliability & Batch Operations

- **Rate Limiting**
  - `src/lib/rate-limiter.ts` - Sliding window rate limiter
  - Per-endpoint configuration
  - Rate limit headers

- **Batch Operations**
  - `src/lib/batch-operations.ts`
  - Bulk task updates, workflow step creation
  - Preload functions to prevent N+1 queries

#### Week 4: Data Management & Backup

- **Project Backup System**
  - `src/lib/backup.ts` - Project export utilities
  - Full hierarchy export
  - `POST /api/projects/[projectId]/backup`
  - Automatic backup rotation (keep last 5)

### Changed

- Prisma schema defaults for video model to "seedance-v2"
- Enhanced logger with buffer integration

## [Beta 0.55] - 2026-03-16

### 中文
1. **稳定性增强**
   - 优化任务超时配置：视频合成从 30 分钟延长至 60 分钟，图片生成从 5 分钟延长至 10 分钟
   - 实现熔断器机制：API 调用失败超过阈值时自动熔断，防止级联故障
   - 增加指数退避重试：任务失败自动重试 3 次，提高成功率
   - 错误分类处理：区分关键错误、可重试错误、可降级错误

2. **一致性控制**
   - 新增角色一致性控制：通过 seed 锁定和描述保持角色形象稳定
   - 新增场景一致性控制：保持场景光线、环境元素一致
   - 智能提示词增强：自动在提示词中注入一致性参数

3. **性能优化**
   - 数据库索引优化：为常用查询添加 15+ 个索引，提升查询速度
   - 批量出图优化：支持并发批量生成，减少总体等待时间
   - 进度预估系统：实时计算剩余时间和完成百分比

4. **降级处理**
   - 图片生成失败时使用占位图，不阻塞整个工作流
   - 失败面板记录详细错误信息，便于排查

### English
1. **Stability Enhancements**
   - Optimized task timeouts: video composition extended from 30min to 60min, image generation from 5min to 10min
   - Implemented circuit breaker: automatic circuit breaking when API failures exceed threshold
   - Added exponential backoff retry: automatic retry up to 3 times on failure
   - Error classification: distinguish critical, retryable, and degradable errors

2. **Consistency Control**
   - Character consistency: seed locking and description for stable character appearance
   - Scene consistency: maintain lighting and environment elements
   - Smart prompt enhancement: auto-inject consistency parameters into prompts

3. **Performance Optimization**
   - Database indexes: added 15+ indexes for common queries
   - Batch image generation: concurrent batch processing
   - Progress estimation: real-time remaining time and percentage calculation

4. **Graceful Degradation**
   - Placeholder images on generation failure without blocking workflow
   - Detailed error logging for failed panels

---

## [Beta 0.50] - 2026-03-15

### 中文
1. **桌面版（Electron）**
   - 新增 `desktop/` 子目录，支持打包为 Windows 安装包（NSIS），一键安装、双击快捷方式即运行
   - 内嵌 Redis：构建时自动下载 Windows 便携版并打入安装包，用户无需单独安装 Redis
   - 内置 Web UI 与窗口：安装后自动启动 Next.js + Worker，打开本地浏览器窗口
   - 支持 OpenClaw 远程控制（连接本机地址即可）
   - 提供 `docker-compose.desktop.yml` 用于启动 MySQL（可选 Docker 方式）
2. **画风（视觉风格）**
   - 一键成片前可选择画风（写实实拍、3D 虚幻 CG、漫剧、日式动画、3D 国漫、电影感、美漫等）
   - 分镜与出图统一采用所选风格；所选画风保存为项目默认
3. **代码健康度修复**
   - advanceRun 并发竞态：Redis 分布式锁保护 phase 切换
   - Worker 任务幂等：重试时已完成任务直接跳过
   - episodeId 路径校验、OpenClaw 参数校验、Next.js 启动时 validateEnv
   - 多步 DB 写入使用事务；API body 校验与视频流式返回；Shell 转义与 SSRF 防护

### English
1. **Desktop (Electron)**
   - New `desktop/` subdirectory: package as Windows installer (NSIS), one-click install and run from shortcut
   - Embedded Redis: auto-download Windows portable Redis during build; users do not need to install Redis
   - Built-in Web UI and window: starts Next.js + Worker and opens local browser window
   - OpenClaw remote control supported (point to localhost)
   - `docker-compose.desktop.yml` for MySQL (optional Docker)
2. **Visual style**
   - Choose visual style before one-click run (live-action, Unreal CG, manhua, anime, 3D donghua, cinematic, American comic)
   - Storyboard and image generation follow the selected style; choice saved as project default
3. **Code health fixes**
   - advanceRun race: Redis distributed lock for phase transition
   - Worker idempotency: skip already completed tasks on retry
   - episodeId path validation, OpenClaw param validation, validateEnv on Next.js startup
   - DB transactions for multi-step writes; API body validation and video streaming; shell escaping and SSRF protection

## [Beta 0.40] - 2026-03-13

### 中文
1. **多模型LLM适配器**: 全新轻量级模型适配系统
   - 支持 8+ 种主流模型：GPT-4o/Claude/DeepSeek/Moonshot/GLM/本地模型等
   - 自动模型适配策略：根据模型特性优化提示词和参数
   - 用户可配置默认模型和自定义模型参数
   - 自动成本估算和 Token 统计
2. **自我修复Agent系统**: 类似OpenClaw的自动诊断修复
   - 自动检测并修复 6 种常见错误类型
   - 智能修复策略：JSON修复、模型降级、任务拆分、指数退避等
   - 学习机制：记录修复成功率，优先使用高效策略
   - 支持自动和手动触发修复
3. **OpenClaw深度集成**: 完整的远程控制能力
   - 新增 `/api/openclaw/control` 控制接口
   - 支持工作流暂停/恢复/取消/重试
   - 支持队列管理：暂停/恢复/清空
   - 支持模型切换和连接测试
   - 支持系统诊断和自动修复触发
4. **数据库扩展**: 新增 `HealingIssue` 表记录修复历史

### English
1. **Multi-Model LLM Adapter**: New lightweight model adaptation system
   - Support 8+ mainstream models: GPT-4o/Claude/DeepSeek/Moonshot/GLM/Local
   - Automatic model adaptation: optimize prompts based on model characteristics
   - User-configurable default models and custom parameters
   - Automatic cost estimation and token tracking
2. **Self-Healing Agent System**: Auto-diagnosis and repair like OpenClaw
   - Auto-detect and fix 6 common error types
   - Smart healing strategies: JSON repair, model fallback, task splitting, exponential backoff
   - Learning mechanism: track success rates, prioritize effective strategies
   - Support automatic and manual healing triggers
3. **OpenClaw Deep Integration**: Complete remote control capabilities
   - New `/api/openclaw/control` API endpoint
   - Workflow pause/resume/cancel/retry support
   - Queue management: pause/resume/clear
   - Model switching and connection testing
   - System diagnosis and auto-fix triggering
4. **Database Extension**: Added `HealingIssue` table for repair history

## [Beta 0.32] - 2026-03-11

### 中文
1. **构建优化**: 修复模块路径引用问题，优化 Docker 多阶段构建
2. **健康检查**: 新增 `/api/health` 端点，支持数据库和 Redis 健康检测
3. **依赖清理**: 移除未使用的 `openai` 和 `react-hot-toast` 依赖
4. **日志系统**: 新增结构化日志工具 `src/lib/logger.ts`
5. **错误处理**: 新增统一错误处理工具 `src/lib/utils/error-handler.ts`
6. **Docker 优化**: 启用 standalone 输出模式，减小镜像体积

### English
1. **Build Optimization**: Fixed module path references, optimized Docker multi-stage builds
2. **Health Check**: Added `/api/health` endpoint with database and Redis health checks
3. **Dependency Cleanup**: Removed unused `openai` and `react-hot-toast` dependencies
4. **Logging System**: Added structured logging utility `src/lib/logger.ts`
5. **Error Handling**: Added unified error handling utility `src/lib/utils/error-handler.ts`
6. **Docker Optimization**: Enabled standalone output mode for smaller image size

---

## [Beta 0.31] - 2026-03-10

### 中文
1. **提示词系统全面优化**: 参考 AI 导演工作流优化四个阶段的 System Prompt
   - 剧本分析：强化角色视觉设定、场景空间信息提取
   - 分场：明确分场原则，规范摘要和场景命名格式
   - 分镜：增加表演调度深化（面部肌肉组、三锚点肢体法）、光影色彩转译、景别运镜词典
   - 配音提取：增加情绪标注、语气提示、音效标注
2. **自定义提示词**: 支持在设置中心自定义四个阶段的 System Prompt
3. **本地模型优化**: 本地端点（localhost/127.0.0.1）无需配置 API Key
4. **自动创建项目修复**: 改为 POST 接口，防止浏览器预加载意外创建项目
5. **数据模型扩展**: Panel 新增 metadata 字段，VoiceLine 新增 lineType/emotion/tone/audioNote 字段

### English
1. **Prompt System Optimization**: Enhanced System Prompts for all 4 workflow phases referencing AI director workflow best practices
2. **Custom Prompts**: Support customizing System Prompts in settings
3. **Local Model Improvements**: Local endpoints don't require API Key
4. **Auto-create Project Fix**: Changed to POST endpoint to prevent accidental project creation
5. **Data Model Extensions**: Added metadata to Panel, added lineType/emotion/tone/audioNote to VoiceLine

---

## [Beta 0.30] - 2026-03-09

### 中文
1. **本地模型支持**: 新增对接 Ollama 和 ComfyUI 本地模型
   - Ollama: 本地 LLM 支持（llama3.2, qwen2.5 等）
   - ComfyUI: 本地 Stable Diffusion 图像生成
   - 零成本、隐私保护、无限生成
2. **OpenClaw 远程控制**: 新增 `flintstudio-control` Skill，支持通过 Telegram/飞书等 IM 平台远程控制 FlintStudio
   - 创建项目、启动工作流、检查状态、获取结果
   - 提供 Telegram Bot 和飞书 Bot 完整示例代码
3. **OpenClaw API 端点**: 新增 7 个 REST API 端点供 OpenClaw 调用
4. **文档精简**: 删除所有冗余文档，仅保留 CHANGELOG.md 和 README.md

### English
1. **Local Model Support**: Added support for Ollama and ComfyUI local models
   - Ollama: Local LLM support (llama3.2, qwen2.5, etc.)
   - ComfyUI: Local Stable Diffusion image generation
   - Zero cost, privacy protection, unlimited generation
2. **OpenClaw Remote Control**: Added `flintstudio-control` Skill for remote control via Telegram/Lark IM platforms
3. **OpenClaw API Endpoints**: Added 7 REST API endpoints for OpenClaw integration
4. **Documentation Cleanup**: Removed all redundant docs, keeping only CHANGELOG.md and README.md

---

## [Beta 0.20] - 2026-03-08

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
