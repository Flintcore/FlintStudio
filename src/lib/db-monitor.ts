/**
 * 数据库连接监控
 * 用于监控连接池状态和健康度
 */

import { prisma } from "./db";
import { logger } from "./logger";
import { cacheGet, cacheSet } from "./cache";

interface DBMetrics {
  timestamp: string;
  queryCount: number;
  slowQueries: number;
  errors: number;
  avgResponseTime: number;
}

const METRICS_KEY = "db:metrics";
const METRICS_WINDOW = 300; // 5分钟

/**
 * 记录查询指标
 */
export async function recordQueryMetric(
  duration: number,
  isSlow: boolean,
  isError: boolean
): Promise<void> {
  try {
    const metrics = await getMetrics();

    metrics.queryCount++;
    if (isSlow) metrics.slowQueries++;
    if (isError) metrics.errors++;

    // 使用移动平均计算平均响应时间
    metrics.avgResponseTime =
      (metrics.avgResponseTime * (metrics.queryCount - 1) + duration) /
      metrics.queryCount;

    await cacheSet(METRICS_KEY, metrics, METRICS_WINDOW);
  } catch {
    // 静默处理监控错误
  }
}

/**
 * 获取当前指标
 */
async function getMetrics(): Promise<DBMetrics> {
  const cached = await cacheGet<DBMetrics>(METRICS_KEY);
  if (cached) return cached;

  return {
    timestamp: new Date().toISOString(),
    queryCount: 0,
    slowQueries: 0,
    errors: 0,
    avgResponseTime: 0,
  };
}

/**
 * 获取数据库健康状态
 */
export async function getDBHealth(): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  metrics: DBMetrics;
  issues: string[];
}> {
  const metrics = await getMetrics();
  const issues: string[] = [];

  // 检查错误率
  if (metrics.queryCount > 0) {
    const errorRate = metrics.errors / metrics.queryCount;
    if (errorRate > 0.1) {
      issues.push(`高错误率: ${(errorRate * 100).toFixed(1)}%`);
    }
  }

  // 检查慢查询率
  if (metrics.queryCount > 0) {
    const slowRate = metrics.slowQueries / metrics.queryCount;
    if (slowRate > 0.2) {
      issues.push(`高慢查询率: ${(slowRate * 100).toFixed(1)}%`);
    }
  }

  // 检查平均响应时间
  if (metrics.avgResponseTime > 1000) {
    issues.push(`平均响应时间过高: ${Math.round(metrics.avgResponseTime)}ms`);
  }

  // 确定状态
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (issues.length >= 2) {
    status = "unhealthy";
  } else if (issues.length === 1) {
    status = "degraded";
  }

  return { status, metrics, issues };
}

/**
 * 测试数据库连接
 */
export async function testConnection(): Promise<{
  connected: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      latency: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * 记录数据库连接错误
 */
export async function logConnectionError(error: Error): Promise<void> {
  logger.error(
    {
      type: "db_connection_error",
      error: error.message,
      stack: error.stack,
    },
    "Database connection error"
  );

  await recordQueryMetric(0, false, true);
}

/**
 * 定期健康检查
 */
export async function runHealthCheck(): Promise<void> {
  const { status, issues } = await getDBHealth();
  const { connected, latency } = await testConnection();

  if (!connected) {
    logger.error(
      { type: "db_health_check", connected, latency },
      "Database health check failed: connection lost"
    );
    return;
  }

  if (status !== "healthy") {
    logger.warn(
      {
        type: "db_health_check",
        status,
        latency,
        issues,
      },
      `Database health check: ${status}`
    );
  } else {
    logger.debug(
      {
        type: "db_health_check",
        status,
        latency,
      },
      "Database health check passed"
    );
  }
}
