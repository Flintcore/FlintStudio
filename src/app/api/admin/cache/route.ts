/**
 * 缓存管理 API
 * POST /api/admin/cache - 清理缓存
 * GET /api/admin/cache - 获取缓存统计
 */

import { NextResponse } from "next/server";
import { cacheFlush } from "@/lib/cache";
import { getLogStats } from "@/lib/log-buffer";
import { logger } from "@/lib/logger";

// POST - 清理缓存
export async function POST() {
  try {
    await cacheFlush();
    logger.info({ type: "cache_cleared" }, "Cache cleared by admin");
    return NextResponse.json({ success: true, message: "缓存已清理" });
  } catch (error) {
    logger.error(
      { type: "cache_clear_error", error: (error as Error).message },
      "Failed to clear cache"
    );
    return NextResponse.json(
      { error: "清理缓存失败" },
      { status: 500 }
    );
  }
}

// GET - 获取缓存统计
export async function GET() {
  try {
    const stats = getLogStats();
    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      { error: "获取缓存统计失败" },
      { status: 500 }
    );
  }
}
