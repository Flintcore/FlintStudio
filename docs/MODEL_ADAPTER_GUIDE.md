# FlintStudio 多模型适配器与自我修复系统

## 🎯 功能概述

本文档介绍 FlintStudio Beta 0.40 新增的三大核心功能：

1. **轻量级多模型LLM适配器** - 支持多种LLM模型的统一调用和配置
2. **自我修复Agent系统** - 自动诊断和修复常见错误
3. **OpenClaw深度集成** - 远程控制程序运行

---

## 📦 多模型LLM适配器

### 支持的模型

| 模型 | Provider | 特点 |
|------|----------|------|
| GPT-4o | OpenAI | 最强通用能力 |
| GPT-4o Mini | OpenAI | 性价比高 |
| Claude 3.5 Sonnet | Anthropic | 超长上下文 |
| DeepSeek Chat | DeepSeek | 国内优秀 |
| DeepSeek Reasoner | DeepSeek | 推理能力强 |
| Moonshot | 月之暗面 | 国内中文好 |
| GLM-4 | 智谱AI | 国内开源 |
| 本地模型 | Ollama | 私有化部署 |

### 模型适配策略

每个模型都有专属的配置策略：

```typescript
// GPT-4o Mini - 廉价模型需要强化约束
{
  systemSuffix: "## 强制检查清单（输出前逐项确认）...",
  jsonMode: { enabled: true, wrapInMarkdown: false },
  rules: { reinforceConstraints: true }
}

// DeepSeek Reasoner - 需要禁用思考过程
{
  systemSuffix: "**重要**: 不要输出思考过程，直接返回最终结果。",
  rules: { disableThinking: true }
}

// Claude 3.5 - XML格式Few-shot效果更好
{
  fewShotFormat: "xml",
  jsonMode: { wrapInMarkdown: true }
}
```

### API 使用

```typescript
import { callAdaptiveLlm } from "@/lib/llm/adaptive-client";

// 使用默认模型
const result = await callAdaptiveLlm({
  userId: "user_xxx",
  systemPrompt: "你是一个剧本分析专家...",
  userPrompt: "请分析以下小说...",
  expectJson: true,
});

// 指定模型
const result = await callAdaptiveLlm({
  userId: "user_xxx",
  modelId: "claude-3-5-sonnet",
  systemPrompt: "...",
  userPrompt: "...",
  expectJson: true,
});

// 返回结果
console.log(result.data);        // 解析后的数据
console.log(result.model);       // 实际使用的模型
console.log(result.cost);        // 估算成本（美元）
console.log(result.usage);       // Token使用量
```

### 设置默认模型

```typescript
import { setDefaultModel } from "@/lib/llm/adaptive-client";

await setDefaultModel(userId, "deepseek-chat");
```

---

## 🩹 自我修复Agent系统

### 自动修复的错误类型

| 错误类型 | 修复策略 |
|---------|---------|
| JSON解析错误 | 使用LLM修复JSON格式 |
| 验证错误 | 使用更强约束重新生成 |
| 速率限制 | 指数退避重试 |
| LLM错误/超时 | 切换到备用模型 |
| 图像生成失败 | 简化prompt重试 |
| 超时 | 任务拆分 |

### 使用自我修复包装器

```typescript
import { withSelfHealing } from "@/lib/agents/self-healing";

const result = await withSelfHealing(
  async () => {
    // 可能失败的LLM调用
    return await callAdaptiveLlm({...});
  },
  {
    userId: "user_xxx",
    taskId: "task_xxx",
    runId: "run_xxx",
    context: { /* 额外上下文 */ },
    onHealed: (result) => {
      console.log("自动修复成功:", result.strategy);
    },
    onFailed: (issue) => {
      console.log("自动修复失败，需要人工介入");
    },
  }
);
```

### 修复统计

```typescript
import { selfHealingAgent } from "@/lib/agents/self-healing";

const stats = selfHealingAgent.getStats();
console.log(stats.topStrategies);  // 成功率最高的策略
```

---

## 🎮 OpenClaw 远程控制

### 控制接口

OpenClaw 可以通过 API 完全控制 FlintStudio：

```bash
# 设置环境变量
export OPENCLAW_TOKEN="your_internal_task_token"

# 暂停工作流
curl -X POST http://localhost:13000/api/openclaw/control \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "pause_workflow",
    "params": { "runId": "run_xxx" }
  }'

# 重试失败任务
curl -X POST http://localhost:13000/api/openclaw/control \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -d '{
    "command": "retry_task",
    "params": { "taskId": "task_xxx" }
  }'

# 运行系统诊断
curl -X POST http://localhost:13000/api/openclaw/control \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -d '{"command": "run_diagnosis"}'

# 自动修复失败任务
curl -X POST http://localhost:13000/api/openclaw/control \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -d '{"command": "auto_fix"}'

# 切换模型
curl -X POST http://localhost:13000/api/openclaw/control \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -d '{
    "command": "switch_model",
    "params": { "userId": "user_xxx", "modelId": "claude-3-5-sonnet" }
  }'

# 测试模型连接
curl -X POST http://localhost:13000/api/openclaw/control \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -d '{
    "command": "test_model",
    "params": { "userId": "user_xxx", "modelId": "gpt-4o" }
  }'

# 暂停队列
curl -X POST http://localhost:13000/api/openclaw/control \
  -H "Authorization: Bearer $OPENCLAW_TOKEN" \
  -d '{
    "command": "pause_queue",
    "params": { "queueType": "text" }
  }'
```

### 支持的命令列表

#### 工作流控制
- `pause_workflow` - 暂停工作流
- `resume_workflow` - 恢复工作流
- `cancel_workflow` - 取消工作流
- `retry_task` - 重试任务

#### 系统控制
- `restart_service` - 重启服务
- `clean_cache` - 清理缓存

#### 诊断和修复
- `run_diagnosis` - 运行系统诊断
- `auto_fix` - 自动修复失败任务
- `get_healing_stats` - 获取修复统计

#### 模型管理
- `switch_model` - 切换默认模型
- `test_model` - 测试模型连接

#### 队列管理
- `pause_queue` - 暂停队列
- `resume_queue` - 恢复队列
- `clear_queue` - 清空队列

---

## 🔧 配置指南

### 1. 更新环境变量

```bash
# .env 文件
INTERNAL_TASK_TOKEN=your_secure_random_token
```

### 2. 更新数据库

```bash
npx prisma migrate dev --name add_healing_system
```

### 3. 配置 OpenClaw Skill

Skill 已经内置完整控制功能：

```bash
# 安装 Skill
curl -fsSL https://raw.githubusercontent.com/Flintcore/FlintStudio/main/skills/flintstudio-deploy/install.sh | bash

# 查看状态
openclaw run flintstudio-deploy status --verbose

# 运行诊断
openclaw run flintstudio-deploy doctor --fix

# 配置 API
openclaw run flintstudio-deploy config
```

---

## 💡 使用建议

### 模型选择建议

| 场景 | 推荐模型 | 原因 |
|------|---------|------|
| 日常开发 | GPT-4o Mini | 成本低，速度快 |
| 生产环境 | GPT-4o | 质量稳定 |
| 超长文本 | Claude 3.5 Sonnet | 200K上下文 |
| 国内部署 | DeepSeek Chat | 中文好，延迟低 |
| 完全离线 | 本地模型 | 数据隐私 |

### 故障排查流程

1. **查看状态**: `openclaw run flintstudio-deploy status`
2. **运行诊断**: `openclaw run flintstudio-deploy doctor`
3. **自动修复**: `openclaw run flintstudio-deploy doctor --fix`
4. **查看日志**: `openclaw run flintstudio-deploy logs --lines 200`
5. **手动干预**: 使用 OpenClaw 控制命令暂停/重试任务

---

## 📊 性能对比

| 模型 | 剧本分析 | 分镜生成 | 成本/千次 |
|------|---------|---------|----------|
| GPT-4o Mini | ★★★☆☆ | ★★★☆☆ | $0.00075 |
| GPT-4o | ★★★★★ | ★★★★★ | $0.0125 |
| Claude 3.5 | ★★★★★ | ★★★★☆ | $0.018 |
| DeepSeek | ★★★★☆ | ★★★★☆ | $0.00042 |

---

## 🔮 未来规划

- [ ] 模型性能自动评测
- [ ] 智能模型切换（根据任务类型选择最优模型）
- [ ] A/B测试不同提示词策略
- [ ] 模型调用缓存层
- [ ] 多模型并行调用（投票机制）
