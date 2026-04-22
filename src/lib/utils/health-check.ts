/**
 * 系统健康检查模块
 * 监控关键系统指标，提前发现潜在问题
 */

import { prisma } from "@/lib/db";
import { queueRedis } from "@/lib/redis";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    database: { ok: boolean; latency: number; message?: string };
    redis: { ok: boolean; latency: number; message?: string };
    disk?: { ok: boolean; used: number; total: number; message?: string };
    memory?: { ok: boolean; used: number; total: number; message?: string };
  };
  timestamp: string;
  version: string;
}

/**
 * 执行完整健康检查
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString();
  const version = process.env.npm_package_version || "0.56.0";

  // 检查数据库
  const dbCheck = await checkDatabase();

  // 检查 Redis
  const redisCheck = await checkRedis();

  // 检查内存
  const memoryCheck = checkMemory();

  // 确定整体状态
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (!dbCheck.ok || !redisCheck.ok) {
    status = "unhealthy";
  } else if (memoryCheck && !memoryCheck.ok) {
    status = "degraded";
  }

  return {
    status,
    checks: {
      database: dbCheck,
      redis: redisCheck,
      memory: memoryCheck,
    },
    timestamp,
    version,
  };
}

async function checkDatabase(): Promise<{ ok: boolean; latency: number; message?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latency: Date.now() - start };
  } catch (error) {
    return {
      ok: false,
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "数据库连接失败",
    };
  }
}

async function checkRedis(): Promise<{ ok: boolean; latency: number; message?: string }> {
  const start = Date.now();
  try {
    await queueRedis.ping();
    return { ok: true, latency: Date.now() - start };
  } catch (error) {
    return {
      ok: false,
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Redis 连接失败",
    };
  }
}

function checkMemory(): { ok: boolean; used: number; total: number; message?: string } {
  const usage = process.memoryUsage();
  const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const ok = usedMB < 1024; // 1GB 阈值

  return {
    ok,
    used: usedMB,
    total: totalMB,
    message: ok ? undefined : `内存使用过高: ${usedMB}MB`,
  };
}

/**
 * 简化版健康检查（用于负载均衡）
 */
export async function quickHealthCheck(): Promise<{ ok: boolean }> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000)),
    ]);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
