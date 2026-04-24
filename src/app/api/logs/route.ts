/**
 * 日志查看 API
 * GET /api/logs - 获取最近日志
 * POST /api/logs/clear - 清空日志
 */

import { NextRequest, NextResponse } from "next/server";
import { getLogs, clearLogs, getLogStats } from "@/lib/log-buffer";
import { getCurrentSession } from "@/lib/auth";

// GET /api/logs - 获取日志
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();

  // 已登录用户可查看日志

  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") || undefined;
  const type = searchParams.get("type") || undefined;
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const since = searchParams.get("since") || undefined;
  const stats = searchParams.get("stats") === "true";

  try {
    if (stats) {
      return NextResponse.json({
        stats: getLogStats(),
        logs: getLogs({ level, type, limit: Math.min(limit, 50), since }),
      });
    }

    const logs = getLogs({ level, type, limit: Math.min(limit, 500), since });

    return NextResponse.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取日志失败", message: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/logs/clear - 清空日志
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();

  const body = await request.json().catch(() => ({}));

  if (body.action === "clear") {
    clearLogs();
    return NextResponse.json({ message: "日志已清空" });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
