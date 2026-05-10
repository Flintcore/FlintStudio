/**
 * 自我修复 Agent 系统
 * 类似 OpenClaw 的自动诊断、修复、学习能力
 */

import { callAdaptiveLlm } from "@/lib/llm/adaptive-client";

// 问题类型定义
export type IssueType = 
  | "llm_error"           // LLM 调用错误
  | "json_parse_error"    // JSON 解析失败
  | "validation_error"    // 数据验证失败
  | "timeout"             // 超时
  | "rate_limit"          // 速率限制
  | "api_error"           // API 错误
  | "image_gen_error"     // 图像生成错误
  | "tts_error"           // 语音合成错误
  | "video_compose_error" // 视频合成错误
  | "worker_crash";       // Worker 崩溃

// 问题严重程度
export type Severity = "info" | "warning" | "error" | "critical";

// 问题记录
export interface Issue {
  id: string;
  type: IssueType;
  severity: Severity;
  message: string;
  context: {
    taskId?: string;
    runId?: string;
    userId: string;
    modelId?: string;
    originalError?: string;
    stackTrace?: string;
    input?: unknown;
    output?: unknown;
  };
  createdAt: Date;
  status: "detected" | "analyzing" | "fixing" | "resolved" | "failed" | "escalated";
  attempts: number;
  fixResult?: FixResult;
}

// 修复结果
export interface FixResult {
  success: boolean;
  strategy: string;
  actionTaken: string;
  newOutput?: unknown;
  cost?: number;
  timeMs: number;
}

// 修复策略
interface HealingStrategy {
  name: string;
  condition: (issue: Issue) => boolean;
  execute: (issue: Issue) => Promise<FixResult>;
}

// 学习记录 - 用于持续改进
interface LearningRecord {
  pattern: string;
  strategy: string;
  successRate: number;
  avgCost: number;
  lastUsed: Date;
}

/**
 * 自我修复 Agent 主类
 */
export class SelfHealingAgent {
  private strategies: HealingStrategy[] = [];
  private learningCache: Map<string, LearningRecord> = new Map();
  private maxAttempts = 3;
  
  constructor() {
    this.registerDefaultStrategies();
  }
  
  /**
   * 注册默认修复策略
   */
  private registerDefaultStrategies() {
    // 1. JSON 解析错误修复
    this.strategies.push({
      name: "json_repair",
      condition: (issue) => issue.type === "json_parse_error",
      execute: async (issue) => {
        const startTime = Date.now();
        
        // 使用 LLM 修复 JSON
        const repairPrompt = `修复以下损坏的 JSON，仅返回修复后的有效 JSON，不要添加任何解释：

${issue.context.originalError}

损坏的 JSON:
${JSON.stringify(issue.context.output)}`;

        try {
          const result = await callAdaptiveLlm({
            userId: issue.context.userId,
            systemPrompt: "你是一个 JSON 修复专家。你的任务是修复损坏的 JSON 数据。只返回修复后的 JSON，不要添加 markdown 代码块标记。",
            userPrompt: repairPrompt,
            temperature: 0.1,
            expectJson: true,
          });
          
          return {
            success: true,
            strategy: "json_repair",
            actionTaken: "使用 LLM 修复 JSON 格式",
            newOutput: result.data,
            cost: result.cost,
            timeMs: Date.now() - startTime,
          };
        } catch (error) {
          return {
            success: false,
            strategy: "json_repair",
            actionTaken: `修复失败: ${error instanceof Error ? error.message : String(error)}`,
            timeMs: Date.now() - startTime,
          };
        }
      },
    });
    
    // 2. LLM 输出格式错误 - 重新生成
    this.strategies.push({
      name: "regenerate_with_stronger_constraints",
      condition: (issue) => issue.type === "validation_error" && issue.attempts < 2,
      execute: async (issue) => {
        const startTime = Date.now();
        
        // 使用更强的约束重新生成
        const strongerPrompt = `${issue.context.input}

**重要提醒**: 之前的输出格式不正确。请确保：
1. 严格按照要求的 JSON 格式返回
2. 所有必填字段都必须有值
3. 不要添加任何解释性文字
4. 确保 JSON 可以被正常解析`;

        try {
          const result = await callAdaptiveLlm({
            userId: issue.context.userId,
            systemPrompt: issue.context.input as string,
            userPrompt: strongerPrompt,
            temperature: 0.1,  // 更低温度
            expectJson: true,
          });
          
          return {
            success: true,
            strategy: "regenerate_with_stronger_constraints",
            actionTaken: "使用更强约束重新生成",
            newOutput: result.data,
            cost: result.cost,
            timeMs: Date.now() - startTime,
          };
        } catch (error) {
          return {
            success: false,
            strategy: "regenerate_with_stronger_constraints",
            actionTaken: `重新生成失败: ${error instanceof Error ? error.message : String(error)}`,
            timeMs: Date.now() - startTime,
          };
        }
      },
    });
    
    // 3. 速率限制 - 指数退避重试
    this.strategies.push({
      name: "rate_limit_backoff",
      condition: (issue) => issue.type === "rate_limit",
      execute: async (issue) => {
        const startTime = Date.now();
        const delay = Math.min(1000 * Math.pow(2, issue.attempts), 30000);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return {
          success: true,
          strategy: "rate_limit_backoff",
          actionTaken: `等待 ${delay}ms 后重试`,
          timeMs: Date.now() - startTime,
        };
      },
    });
    
    // 4. 模型切换 - 当某个模型反复失败时
    this.strategies.push({
      name: "fallback_model",
      condition: (issue) => 
        (issue.type === "llm_error" || issue.type === "timeout") && 
        issue.attempts >= 2,
      execute: async (issue) => {
        const startTime = Date.now();
        
        // 切换到备用模型
        const fallbackModels = ["gpt-4o", "claude-3-5-sonnet", "deepseek-chat"];
        const currentIndex = issue.context.modelId 
          ? fallbackModels.indexOf(issue.context.modelId)
          : -1;
        const fallbackModel = fallbackModels[currentIndex + 1] || fallbackModels[0];
        
        try {
          const result = await callAdaptiveLlm({
            userId: issue.context.userId,
            modelId: fallbackModel,
            systemPrompt: (issue.context.input as Record<string, string>)?.systemPrompt || "",
            userPrompt: (issue.context.input as Record<string, string>)?.userPrompt || "",
            temperature: 0.3,
            expectJson: true,
          });
          
          return {
            success: true,
            strategy: "fallback_model",
            actionTaken: `切换到备用模型: ${fallbackModel}`,
            newOutput: result.data,
            cost: result.cost,
            timeMs: Date.now() - startTime,
          };
        } catch (error) {
          return {
            success: false,
            strategy: "fallback_model",
            actionTaken: `切换模型失败: ${error instanceof Error ? error.message : String(error)}`,
            timeMs: Date.now() - startTime,
          };
        }
      },
    });
    
    // 5. 图像生成失败 - 简化 prompt 重试
    this.strategies.push({
      name: "simplify_image_prompt",
      condition: (issue) => issue.type === "image_gen_error",
      execute: async (issue) => {
        const startTime = Date.now();
        
        // 使用 LLM 简化图像 prompt
        const simplifyPrompt = `简化以下图像生成提示词，保留核心要素但减少复杂度：

${issue.context.input}`;

        try {
          const result = await callAdaptiveLlm({
            userId: issue.context.userId,
            systemPrompt: "你是一个图像提示词优化专家。简化提示词以解决生成失败问题。",
            userPrompt: simplifyPrompt,
            temperature: 0.3,
            expectJson: false,
          });
          
          return {
            success: true,
            strategy: "simplify_image_prompt",
            actionTaken: "简化图像 prompt",
            newOutput: result.raw,
            cost: result.cost,
            timeMs: Date.now() - startTime,
          };
        } catch (error) {
          return {
            success: false,
            strategy: "simplify_image_prompt",
            actionTaken: `简化失败: ${error instanceof Error ? error.message : String(error)}`,
            timeMs: Date.now() - startTime,
          };
        }
      },
    });
    
    // 6. 超时错误 - 任务拆分
    this.strategies.push({
      name: "task_splitting",
      condition: (issue) => issue.type === "timeout" && issue.attempts >= 2,
      execute: async (issue) => {
        const startTime = Date.now();
        
        // 将大任务拆分为小任务
        const splitPrompt = `将以下任务拆分为2-3个更小的子任务，分别处理：

${JSON.stringify(issue.context.input)}`;

        try {
          const result = await callAdaptiveLlm({
            userId: issue.context.userId,
            systemPrompt: "你是一个任务规划专家。将大任务拆分为可并行或顺序执行的小任务。",
            userPrompt: splitPrompt,
            temperature: 0.3,
            expectJson: true,
          });
          
          return {
            success: true,
            strategy: "task_splitting",
            actionTaken: "将任务拆分为子任务",
            newOutput: result.data,
            cost: result.cost,
            timeMs: Date.now() - startTime,
          };
        } catch (error) {
          return {
            success: false,
            strategy: "task_splitting",
            actionTaken: `拆分失败: ${error instanceof Error ? error.message : String(error)}`,
            timeMs: Date.now() - startTime,
          };
        }
      },
    });
  }
  
  /**
   * 检测并记录问题
   */
  async detectIssue(
    type: IssueType,
    severity: Severity,
    message: string,
    context: Issue["context"]
  ): Promise<Issue> {
    const issue: Issue = {
      id: crypto.randomUUID(),
      type,
      severity,
      message,
      context,
      createdAt: new Date(),
      status: "detected",
      attempts: 0,
    };
    
    console.log(`[SelfHealing] 检测到问题: ${type} - ${message}`);
    
    return issue;
  }
  
  /**
   * 执行修复
   */
  async heal(issue: Issue): Promise<FixResult> {
    if (issue.attempts >= this.maxAttempts) {
      return {
        success: false,
        strategy: "max_attempts_reached",
        actionTaken: `已达到最大修复次数 (${this.maxAttempts})，需要人工介入`,
        timeMs: 0,
      };
    }
    
    // 查找匹配的策略
    const matchingStrategies = this.strategies.filter(s => s.condition(issue));
    
    // 按学习记录排序，优先使用成功率高的策略
    const sortedStrategies = this.sortStrategiesBySuccessRate(matchingStrategies, issue.type);
    
    for (const strategy of sortedStrategies) {
      console.log(`[SelfHealing] 尝试修复策略: ${strategy.name}`);
      
      try {
        const result = await strategy.execute(issue);
        issue.attempts++;
        
        // 更新学习缓存
        this.updateLearningCache(issue.type, strategy.name, result.success, result.cost || 0);
        
        if (result.success) {
          console.log(`[SelfHealing] 修复成功: ${strategy.name}`);
          return result;
        }
        
        console.log(`[SelfHealing] 修复失败: ${strategy.name}，尝试下一个策略`);
      } catch (error) {
        console.error(`[SelfHealing] 策略执行出错: ${strategy.name}`, error);
      }
    }
    
    // 所有策略都失败
    return {
      success: false,
      strategy: "all_strategies_failed",
      actionTaken: "所有自动修复策略均失败，需要人工介入",
      timeMs: 0,
    };
  }
  
  /**
   * 按成功率排序策略
   */
  private sortStrategiesBySuccessRate(strategies: HealingStrategy[], issueType: IssueType): HealingStrategy[] {
    return strategies.sort((a, b) => {
      const recordA = this.learningCache.get(`${issueType}:${a.name}`);
      const recordB = this.learningCache.get(`${issueType}:${b.name}`);
      const rateA = recordA?.successRate || 0;
      const rateB = recordB?.successRate || 0;
      return rateB - rateA;
    });
  }
  
  /**
   * 更新学习缓存
   */
  private updateLearningCache(issueType: string, strategyName: string, success: boolean, cost: number) {
    const key = `${issueType}:${strategyName}`;
    const existing = this.learningCache.get(key);
    
    if (existing) {
      const totalAttempts = existing.successRate * 10 + 1;  // 估算
      const newSuccessRate = (existing.successRate * totalAttempts + (success ? 1 : 0)) / (totalAttempts + 1);
      const newAvgCost = (existing.avgCost * totalAttempts + cost) / (totalAttempts + 1);
      
      this.learningCache.set(key, {
        pattern: key,
        strategy: strategyName,
        successRate: newSuccessRate,
        avgCost: newAvgCost,
        lastUsed: new Date(),
      });
    } else {
      this.learningCache.set(key, {
        pattern: key,
        strategy: strategyName,
        successRate: success ? 1 : 0,
        avgCost: cost,
        lastUsed: new Date(),
      });
    }
  }
  
  /**
   * 获取修复统计
   */
  getStats(): {
    learningCacheSize: number;
    topStrategies: { name: string; successRate: number; avgCost: number }[];
  } {
    // 从学习缓存获取策略统计
    const strategyStats = Array.from(this.learningCache.entries())
      .map(([key, record]) => ({
        name: record.strategy,
        pattern: record.pattern,
        successRate: record.successRate,
        avgCost: record.avgCost,
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10);
    
    return {
      learningCacheSize: this.learningCache.size,
      topStrategies: strategyStats,
    };
  }
}

// 单例实例
export const selfHealingAgent = new SelfHealingAgent();

/**
 * 包装函数：自动检测和修复
 */
export async function withSelfHealing<T>(
  operation: () => Promise<T>,
  options: {
    userId: string;
    taskId?: string;
    runId?: string;
    context: Record<string, unknown>;
    onHealed?: (result: FixResult) => void;
    onFailed?: (issue: Issue) => void;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 识别错误类型
    let issueType: IssueType = "llm_error";
    let severity: Severity = "error";
    
    if (errorMessage.includes("JSON") || errorMessage.includes("parse")) {
      issueType = "json_parse_error";
      severity = "warning";
    } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
      issueType = "timeout";
      severity = "warning";
    } else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
      issueType = "rate_limit";
      severity = "warning";
    } else if (errorMessage.includes("validation")) {
      issueType = "validation_error";
      severity = "warning";
    }
    
    // 记录问题
    const issue = await selfHealingAgent.detectIssue(
      issueType,
      severity,
      errorMessage,
      {
        userId: options.userId,
        taskId: options.taskId,
        runId: options.runId,
        originalError: errorMessage,
        stackTrace: error instanceof Error ? error.stack : undefined,
        input: options.context,
      }
    );
    
    // 尝试修复
    const fixResult = await selfHealingAgent.heal(issue);
    
    if (fixResult.success && fixResult.newOutput !== undefined) {
      options.onHealed?.(fixResult);
      return fixResult.newOutput as T;
    }
    
    // 修复失败，调用失败回调
    options.onFailed?.(issue);
    throw error;
  }
}
