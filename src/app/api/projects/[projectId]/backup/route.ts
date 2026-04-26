/**
 * 项目备份 API
 * POST /api/projects/[projectId]/backup - 创建备份
 * GET /api/projects/[projectId]/backup - 获取备份列表
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { createProjectBackup } from "@/lib/backup";
import { promises as fs } from "fs";
import path from "path";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// POST - 创建备份
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    const { projectId } = await params;

    logger.info(
      { type: "backup_request", projectId, userId: session.user.id },
      `Backup requested for project ${projectId}`
    );

    const result = await createProjectBackup(projectId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        filepath: result.filepath,
        message: "备份创建成功",
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error(
      { type: "backup_api_error", error: (error as Error).message },
      "Backup API error"
    );
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// GET - 获取备份列表
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await getCurrentSession();
    const { projectId } = await params;

    const dataDir = process.env.DATA_DIR || "./data";
    const backupDir = path.join(dataDir, "backups");

    try {
      const files = await fs.readdir(backupDir);
      const projectFiles = await Promise.all(
        files
          .filter(
            (f) => f.startsWith(`project-${projectId}-`) && f.endsWith(".json")
          )
          .map(async (f) => {
            const stat = await fs.stat(path.join(backupDir, f));
            return {
              filename: f,
              size: stat.size,
              createdAt: stat.mtime.toISOString(),
            };
          })
      );

      projectFiles.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return NextResponse.json({ backups: projectFiles });
    } catch {
      // 目录不存在时返回空列表
      return NextResponse.json({ backups: [] });
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
