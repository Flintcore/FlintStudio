/**
 * 环境配置检查 API
 * GET /api/admin/config-check - 获取配置检查结果
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { checkAllConfig, formatCheckResult } from "@/lib/config-check";

export async function GET(request: Request) {
  try {
    await getCurrentSession();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    const result = checkAllConfig();

    if (format === "text") {
      return new Response(formatCheckResult(result), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
