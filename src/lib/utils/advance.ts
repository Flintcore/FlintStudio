/**
 * 工作流推进补偿机制
 * 确保 Worker 完成任务后能可靠地推进工作流状态
 */

import { env } from "@/lib/env";
import { resolveInternalTaskToken } from "@/lib/internal-task-token";

const NEXT_PUBLIC_APP_URL = env.NEXTAUTH_URL;

// 推进请求配置
const ADVANCE_RETRY_OPTIONS = {
  maxAttempts: 5,
  initialDelay: 500,
  maxDelay: 10000,
  backoffMultiplier: 2,
  timeout: 30000,
};

/**
 * 调用工作流推进 API
 * 失败后会自动重试，确保工作流状态一致性
 */
export async function callAdvance(runId: string, taskId: string): Promise<void> {
  let lastError: Error | null = null;

  const bearer = await resolveInternalTaskToken();

  for (let attempt = 1; attempt <= ADVANCE_RETRY_OPTIONS.maxAttempts; attempt++) {
    try {
      const res = await fetch(`${NEXT_PUBLIC_APP_URL}/api/workflows/advance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({ runId, taskId }),
      });

      if (res.ok) {
        // 成功
        if (attempt > 1) {
          console.log(`[Advance] 第 ${attempt} 次重试成功，runId=${runId}, taskId=${taskId}`);
        }
        return;
      }

      // 非 2xx 响应
      const errText = await res.text();
      lastError = new Error(`HTTP ${res.status}: ${errText}`);

      // 如果是 4xx 错误（除 429 外），不重试
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        console.error(`[Advance] 客户端错误，放弃重试: ${res.status} ${errText}`);
        throw lastError;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 网络错误，需要重试
      if (attempt < ADVANCE_RETRY_OPTIONS.maxAttempts) {
        const delay = Math.min(
          ADVANCE_RETRY_OPTIONS.initialDelay * Math.pow(ADVANCE_RETRY_OPTIONS.backoffMultiplier, attempt - 1),
          ADVANCE_RETRY_OPTIONS.maxDelay
        );
        
        console.warn(
          `[Advance] 推进失败，第 ${attempt}/${ADVANCE_RETRY_OPTIONS.maxAttempts} 次尝试，${delay}ms 后重试: ${lastError.message}`
        );
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // 所有重试都失败了
  const finalError = lastError ?? new Error("推进工作流失败，重试次数耗尽");
  console.error(`[Advance] 严重错误: 无法推进工作流 runId=${runId}, taskId=${taskId}: ${finalError.message}`);
  
  // TODO: 可以在这里添加告警通知（如发送邮件、Slack 消息等）
  // await sendAlert(`工作流推进失败: runId=${runId}, taskId=${taskId}, error=${finalError.message}`);
  
  throw finalError;
}

/**
 * 批量推进多个任务（用于恢复场景）
 */
export async function batchAdvance(runId: string, taskIds: string[]): Promise<void> {
  console.log(`[Advance] 批量推进 runId=${runId}, 任务数=${taskIds.length}`);
  
  for (const taskId of taskIds) {
    try {
      await callAdvance(runId, taskId);
      // 稍微延迟，避免并发过高
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[Advance] 批量推进中任务失败: taskId=${taskId}`, error);
      // 继续处理下一个，不中断整个批次
    }
  }
}
