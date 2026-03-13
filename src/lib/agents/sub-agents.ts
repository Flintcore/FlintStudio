/**
 * 子 Agent 系统
 * 用于并行执行特定任务的轻量级 Agent
 */

import { callAdaptiveLlm } from "@/lib/llm/adaptive-client";

export interface SubAgentTask {
  id: string;
  type: "summarize" | "extract" | "rewrite" | "validate" | "generate";
  input: string;
  context?: Record<string, unknown>;
}

export interface SubAgentResult {
  taskId: string;
  success: boolean;
  output: string;
  cost?: number;
  timeMs: number;
}

/**
 * 子 Agent 执行器
 * 并行执行多个子任务
 */
export async function executeSubAgents(
  userId: string,
  tasks: SubAgentTask[],
  options?: {
    maxConcurrency?: number;
    timeoutMs?: number;
  }
): Promise<SubAgentResult[]> {
  const maxConcurrency = options?.maxConcurrency ?? 3;
  const timeoutMs = options?.timeoutMs ?? 60000;

  const results: SubAgentResult[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = executeSingleSubAgent(userId, task, timeoutMs).then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

async function executeSingleSubAgent(
  userId: string,
  task: SubAgentTask,
  timeoutMs: number
): Promise<SubAgentResult> {
  const startTime = Date.now();

  const systemPrompts: Record<SubAgentTask["type"], string> = {
    summarize: "你是一个专业的文本摘要专家。请对输入内容进行简洁的摘要。",
    extract: "你是一个信息提取专家。请从输入中提取关键信息并以结构化方式返回。",
    rewrite: "你是一个文案改写专家。请保持原意的同时优化表达方式。",
    validate: "你是一个内容校验专家。请检查输入内容的准确性和完整性。",
    generate: "你是一个创意生成专家。请基于输入生成高质量的内容。",
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const result = await callAdaptiveLlm({
      userId,
      systemPrompt: systemPrompts[task.type],
      userPrompt: task.input,
      temperature: 0.3,
      expectJson: false,
    });

    clearTimeout(timeoutId);

    return {
      taskId: task.id,
      success: true,
      output: result.raw,
      cost: result.cost,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      taskId: task.id,
      success: false,
      output: error instanceof Error ? error.message : "执行失败",
      timeMs: Date.now() - startTime,
    };
  }
}

/**
 * 智能任务拆分
 * 将大任务拆分为多个子任务并行执行
 */
export async function splitAndExecute(
  userId: string,
  content: string,
  splitStrategy: "byParagraph" | "bySection" | "byChapter",
  processType: SubAgentTask["type"]
): Promise<SubAgentResult[]> {
  // 根据策略拆分内容
  const segments = splitContent(content, splitStrategy);

  // 创建子任务
  const tasks: SubAgentTask[] = segments.map((segment, index) => ({
    id: `subtask-${index}`,
    type: processType,
    input: segment,
  }));

  // 并行执行
  return executeSubAgents(userId, tasks);
}

function splitContent(
  content: string,
  strategy: "byParagraph" | "bySection" | "byChapter"
): string[] {
  switch (strategy) {
    case "byParagraph":
      return content.split(/\n\s*\n/).filter((p) => p.trim());
    case "bySection":
      return content.split(/#{1,3}\s/).filter((s) => s.trim());
    case "byChapter":
      return content.split(/第[一二三四五六七八九十\d]+章/).filter((c) => c.trim());
    default:
      return [content];
  }
}
