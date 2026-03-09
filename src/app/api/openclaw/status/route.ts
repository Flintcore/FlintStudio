import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { WORKFLOW_ID } from "@/lib/workflow/types";

// 验证 INTERNAL_TASK_TOKEN
function verifyInternalToken(req: Request): boolean {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  return token === process.env.INTERNAL_TASK_TOKEN;
}

// GET: 返回系统状态（是否运行中、版本信息）
export async function GET(req: Request) {
  try {
    // 验证 token
    if (!verifyInternalToken(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 获取版本信息
    const version = process.env.npm_package_version || "0.1.0";

    // 检查数据库连接状态
    let dbStatus = "connected";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "disconnected";
    }

    // 统计活跃的运行任务
    const activeRuns = await prisma.graphRun.count({
      where: {
        status: { in: ["queued", "running"] },
      },
    });

    // 统计今日运行任务
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRuns = await prisma.graphRun.count({
      where: {
        createdAt: { gte: today },
      },
    });

    // 统计项目数量
    const projectCount = await prisma.project.count();

    // 统计剧集数量
    const episodeCount = await prisma.novelPromotionEpisode.count();

    return NextResponse.json({
      status: "ok",
      version,
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        worker: "running", // Worker 状态，由外部监控
      },
      stats: {
        activeRuns,
        todayRuns,
        projectCount,
        episodeCount,
      },
      workflows: {
        available: [WORKFLOW_ID.NOVEL_TO_VIDEO],
        default: WORKFLOW_ID.NOVEL_TO_VIDEO,
      },
    });
  } catch (error) {
    console.error("[openclaw/status]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
