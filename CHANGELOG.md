# 更新日志 · Changelog

本文档记录 FlintStudio 的版本更新内容。  
This file documents notable changes to FlintStudio.

---

## [Unreleased]

### 中文
- **API 对接**：统一 OpenAI 兼容路径（`/v1/chat/completions`、`/v1/images/generations`、`/v1/audio/speech`），Base URL 自动补 `/v1`；设置中支持为 LLM/图像/视频配置可选模型名，便于多模型、多端点对接。
- **多 Agent 与复查**：剧本分析完成后自动执行「复查 Agent」对集数/角色/场景做质检，结果写入步骤；运行详情展示每步简要结果（集数、复查通过/问题），避免黑盒。
- 初始开源版本：小说 → 剧本分析 → 分场 → 分镜 → 出图 → 配音 → 视频合成，全流程可配置 API。

### English
- **API**: OpenAI-compatible paths with auto `/v1`; optional model names per type (LLM/image/video) in settings for multi-model and multi-endpoint support.
- **Multi-agent & review**: After script analysis, a review agent validates episodes/characters/locations; step results are stored and shown in run details (no black box).
- Initial release: novel → analysis → scene split → storyboard → images → voice → video; all APIs configurable.

---

格式说明 / Format: 版本号 [x.y.z] 下列出该版本的变更条目。  
Add new entries under `## [x.y.z] - YYYY-MM-DD` when releasing.
