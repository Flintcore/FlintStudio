import { NextResponse } from "next/server";
import { performHealthCheck, quickHealthCheck } from "@/lib/utils/health-check";

/**
 * 健康检查端点
 * GET /api/health?quick=true - 快速检查（用于负载均衡）
 * GET /api/health - 完整检查（用于监控面板）
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quick = searchParams.get("quick") === "true";

  if (quick) {
    const { ok } = await quickHealthCheck();
    return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
  }

  const health = await performHealthCheck();
  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
