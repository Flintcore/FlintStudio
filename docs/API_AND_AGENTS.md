# API 对接与多 Agent 说明

## 一、OpenAI 兼容 API 格式

所有可配置的 AI 服务均按 **OpenAI 官方接口** 约定调用，Base URL 若未包含 `/v1` 会自动补全，便于对接自建或第三方兼容端点。

| 类型 | 路径 | 说明 |
|------|------|------|
| 大语言模型 | `POST /v1/chat/completions` | 剧本分析、分场、分镜、复查等 |
| 图像生成 | `POST /v1/images/generations` | 分镜出图 |
| 语音合成 | `POST /v1/audio/speech` | 配音 TTS |

- **LLM**：请求体含 `model`、`messages`、`temperature`，可选 `response_format: { type: "json_object" }`。  
  推荐 Base URL 示例：`https://api.openai.com/v1`、`https://openrouter.ai/api/v1`、自建代理地址。
- **图像**：请求体含 `model`、`prompt`、`n`、`size`、`response_format`。  
  常见模型：`dall-e-3`、兼容 DALL·E 的自建模型。
- **TTS**：请求体含 `model`、`voice`、`input`。  
  常见模型：`tts-1` / `tts-1-hd`。

设置中的 **模型** 为可选；不填时使用默认（如 `gpt-4o-mini`、`dall-e-3`、`tts-1`）。支持同一 Base URL 下多模型切换（如 OpenRouter 不同模型 ID）。

## 二、多 API 对接（当前与后续）

- **当前**：每种类型（LLM / 图像 / TTS / 视频）支持一组 Base URL + API Key + 可选模型名；可在设置中为不同能力配置不同端点或模型。
- **后续**：数据库已预留 `customProviders`（JSON），可扩展为多组 Provider（如多个 OpenRouter、自建、厂商直连），按类型选择「主用 / 备用」或按任务选择 Provider，实现真正的多 API 并存与切换。

## 三、多 Agent 协同与自动化复查

- **流水线**：剧本分析 → 分场 → 分镜 → 出图 → 配音 → 视频合成，各阶段由独立任务（Agent）执行，步骤与结果落库。
- **复查 Agent**：剧本分析完成后自动调用一次 **复查 Agent**（LLM），对「集数、角色、场景」做简要质检，返回 `{ ok, issues[] }`，与当步结果一并写入该步骤的 `result`，便于排查与审计。
- **可观测**：运行详情中每个步骤会展示简要结果（如「集数: N · 复查: 通过」或「复查: 问题描述」），避免黑盒；后续可扩展为每步的输入/输出全文、重试记录等。

## 四、参考

- OpenAI 官方文档：[API Reference](https://platform.openai.com/docs/api-reference)。

## 五、多 Agent 现状与目标

**当前**：流水线为「顺序步骤 + 剧本分析后一次复查」，各步有独立任务与结果落库，可观测。尚未达到「真正全流程影视一体化 Agent」的完整形态。

**真正多 Agent 协同**通常包括：  
- **显式 Agent 角色**：每个阶段有明确命名与职责（如剧本分析 Agent、分场 Agent、分镜 Agent、质检/复查 Agent、出图 Agent 等），输入输出契约清晰。  
- **可反馈与重试**：复查或下游 Agent 发现问题时，能触发上游重跑或指定步骤重试，而不是仅记录问题。  
- **编排与分支**：支持条件分支（如某集无对白则跳过配音）、人工审核节点、多路径成片。  
- **状态与可观测**：每步的输入/输出/用时/模型可查，便于调试与审计。

**后续可做**：在上述流水线基础上，为每步赋予显式 Agent 身份、增加「复查不通过 → 自动重试/人工介入」策略、支持步骤级重跑与分支编排，逐步趋近真正的全流程影视一体化 Agent。  
详见 [CURRENT_SHORTCOMINGS.md](./CURRENT_SHORTCOMINGS.md)。
