/**
 * Worker 指标收集
 * 用于监控任务处理性能和队列状态
 */

import { logger } from "@/lib/logger";
import { cacheGet, cacheSet } from "@/lib/cache";

interface TaskMetric {
  taskType: string;
  taskId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "running" | "completed" | "failed" | "timeout";
  error?: string;
}

interface WorkerStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  timeoutTasks: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  errorsByType: Record<string, number>;
}

const METRICS_KEY = "worker:metrics";
const STATS_WINDOW = 3600; // 1小时

/**
 * 记录任务开始
 */
export function recordTaskStart(taskType: string, taskId: string): void {
  const metric: TaskMetric = {
    taskType,
    taskId,
    startTime: Date.now(),
    status: "running",
  };

  // 存储到内存（短期）
  activeMetrics.set(taskId, metric);
}

const activeMetrics = new Map<string, TaskMetric>();

/**
 * 记录任务完成
 */
export async function recordTaskComplete(
  taskId: string,
  status: "completed" | "failed" | "timeout",
  error?: string
): Promise<void> {
  const metric = activeMetrics.get(taskId);
  if (!metric) return;

  metric.endTime = Date.now();
  metric.duration = metric.endTime - metric.startTime;
  metric.status = status;
  if (error) metric.error = error;

  // 更新统计
  await updateStats(metric);

  // 清理
  activeMetrics.delete(taskId);

  // 记录日志
  logger.debug(
    {
      type: "task_metric",
      taskType: metric.taskType,
      taskId,
      duration: metric.duration,
      status,
    },
    `Task ${taskId} ${status} in ${metric.duration}ms`
  );
}

/**
 * 更新统计数据
 */
async function updateStats(metric: TaskMetric): Promise<void> {
  const stats = await getStats();

  stats.totalTasks++;
  if (metric.status === "completed") stats.completedTasks++;
  if (metric.status === "failed") stats.failedTasks++;
  if (metric.status === "timeout") stats.timeoutTasks++;

  if (metric.duration) {
    // 更新平均时长
    const completedCount = stats.completedTasks;
    stats.avgDuration =
      (stats.avgDuration * (completedCount - 1) + metric.duration) /
      completedCount;
    stats.maxDuration = Math.max(stats.maxDuration, metric.duration);
    stats.minDuration =
      stats.minDuration === 0
        ? metric.duration
        : Math.min(stats.minDuration, metric.duration);
  }

  // 记录错误类型
  if (metric.error) {
    const errorType = classifyError(metric.error);
    stats.errorsByType[errorType] = (stats.errorsByType[errorType] || 0) + 1;
  }

  await cacheSet(METRICS_KEY, stats, STATS_WINDOW);
}

/**
 * 获取统计数据
 */
async function getStats(): Promise<WorkerStats> {
  const cached = await cacheGet<WorkerStats>(METRICS_KEY);
  if (cached) return cached;

  return {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    timeoutTasks: 0,
    avgDuration: 0,
    maxDuration: 0,
    minDuration: 0,
    errorsByType: {},
  };
}

/**
 * 错误分类
 */
function classifyError(error: string): string {
  if (error.includes("timeout")) return "timeout";
  if (error.includes("rate limit")) return "rate_limit";
  if (error.includes("connection")) return "connection";
  if (error.includes("authentication")) return "auth";
  if (error.includes("validation")) return "validation";
  return "other";
}

/**
 * 获取 Worker 统计摘要
 */
export async function getWorkerStats(): Promise<WorkerStats & { activeTasks: number }> {
  const stats = await getStats();
  return {
    ...stats,
    activeTasks: activeMetrics.size,
  };
}

/**
 * 获取活跃任务列表
 */
export function getActiveTasks(): TaskMetric[] {
  return Array.from(activeMetrics.values()).map((m) => ({ ...m }));
}

/**
 * 重置统计
 */
export async function resetStats(): Promise<void> {
  activeMetrics.clear();
  await cacheSet(
    METRICS_KEY,
    {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      timeoutTasks: 0,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: 0,
      errorsByType: {},
    },
    STATS_WINDOW
  );
}
