import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { queueRedis } from "@/lib/redis";

/**
 * 健康检查端点
 * GET /api/health
 * 用于 Docker 健康检查和负载均衡
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "error"; latency: number; message?: string }> = {};
  let overallStatus = "ok";

  // 检查数据库
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      status: "error",
      latency: Date.now() - dbStart,
      message: error instanceof Error ? error.message : "Database connection failed",
    };
    overallStatus = "error";
  }

  // 检查 Redis
  const redisStart = Date.now();
  try {
    await queueRedis.ping();
    checks.redis = { status: "ok", latency: Date.now() - redisStart };
  } catch (error) {
    checks.redis = {
      status: "error",
      latency: Date.now() - redisStart,
      message: error instanceof Error ? error.message : "Redis connection failed",
    };
    overallStatus = "error";
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "unknown",
    checks,
  };

  return NextResponse.json(response, {
    status: overallStatus === "ok" ? 200 : 503,
  });
}
