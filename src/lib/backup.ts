/**
 * 数据备份与导出系统
 * 支持项目、剧集数据的导出和备份
 */

import { prisma } from "./db";
import { logger } from "./logger";
import { promises as fs } from "fs";
import path from "path";

export interface ProjectBackup {
  version: string;
  exportedAt: string;
  project: {
    name: string;
    description: string | null;
    mode: string;
    createdAt: string;
    updatedAt: string;
  };
  novelPromotion: {
    analysisModel: string | null;
    imageModel: string | null;
    videoModel: string | null;
    artStyle: string;
    videoRatio: string;
    videoResolution: string;
    imageResolution: string;
  } | null;
  characters: Array<{
    name: string;
    aliases: string | null;
    profileData: string | null;
    voiceId: string | null;
  }>;
  locations: Array<{
    name: string;
    summary: string | null;
  }>;
  episodes: Array<{
    episodeNumber: number;
    name: string;
    novelText: string | null;
    srtContent: string | null;
    clips: Array<{
      summary: string;
      content: string;
      location: string | null;
    }>;
    voiceLines: Array<{
      lineIndex: number;
      speaker: string;
      content: string;
      lineType: string | null;
      emotion: string | null;
    }>;
  }>;
}

/**
 * 导出项目数据
 */
export async function exportProject(projectId: string): Promise<ProjectBackup> {
  const start = Date.now();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      novelPromotion: {
        include: {
          characters: true,
          locations: true,
          episodes: {
            include: {
              clips: true,
              voiceLines: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const backup: ProjectBackup = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      description: project.description,
      mode: project.mode,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
    novelPromotion: project.novelPromotion
      ? {
          analysisModel: project.novelPromotion.analysisModel,
          imageModel: project.novelPromotion.imageModel,
          videoModel: project.novelPromotion.videoModel,
          artStyle: project.novelPromotion.artStyle,
          videoRatio: project.novelPromotion.videoRatio,
          videoResolution: project.novelPromotion.videoResolution,
          imageResolution: project.novelPromotion.imageResolution,
        }
      : null,
    characters:
      project.novelPromotion?.characters.map((c) => ({
        name: c.name,
        aliases: c.aliases,
        profileData: c.profileData,
        voiceId: c.voiceId,
      })) || [],
    locations:
      project.novelPromotion?.locations.map((l) => ({
        name: l.name,
        summary: l.summary,
      })) || [],
    episodes:
      project.novelPromotion?.episodes.map((e) => ({
        episodeNumber: e.episodeNumber,
        name: e.name,
        novelText: e.novelText,
        srtContent: e.srtContent,
        clips:
          e.clips.map((c) => ({
            summary: c.summary,
            content: c.content,
            location: c.location,
          })) || [],
        voiceLines:
          e.voiceLines.map((v) => ({
            lineIndex: v.lineIndex,
            speaker: v.speaker,
            content: v.content,
            lineType: v.lineType,
            emotion: v.emotion,
          })) || [],
      })) || [],
  };

  logger.info(
    {
      type: "export",
      projectId,
      duration: Date.now() - start,
      episodes: backup.episodes.length,
    },
    `Exported project ${projectId}`
  );

  return backup;
}

/**
 * 保存备份到文件
 */
export async function saveBackupToFile(
  projectId: string,
  backup: ProjectBackup
): Promise<string> {
  const dataDir = process.env.DATA_DIR || "./data";
  const backupDir = path.join(dataDir, "backups");

  // 确保备份目录存在
  await fs.mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `project-${projectId}-${timestamp}.json`;
  const filepath = path.join(backupDir, filename);

  await fs.writeFile(filepath, JSON.stringify(backup, null, 2), "utf-8");

  logger.info(
    {
      type: "backup_saved",
      projectId,
      filepath,
    },
    `Backup saved to ${filepath}`
  );

  return filepath;
}

/**
 * 清理旧备份（保留最近 N 个）
 */
export async function cleanupOldBackups(
  projectId: string,
  keepCount: number = 5
): Promise<void> {
  const dataDir = process.env.DATA_DIR || "./data";
  const backupDir = path.join(dataDir, "backups");

  try {
    const files = await fs.readdir(backupDir);
    const projectFiles = files
      .filter((f) => f.startsWith(`project-${projectId}-`) && f.endsWith(".json"))
      .map((f) => ({
        name: f,
        path: path.join(backupDir, f),
        stat: fs.stat(path.join(backupDir, f)),
      }));

    // 按时间排序
    const sortedFiles = await Promise.all(
      projectFiles.map(async (f) => ({
        ...f,
        stat: await f.stat,
      }))
    );
    sortedFiles.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

    // 删除旧文件
    const toDelete = sortedFiles.slice(keepCount);
    for (const file of toDelete) {
      await fs.unlink(file.path);
      logger.debug(
        { type: "backup_cleanup", file: file.name },
        `Deleted old backup: ${file.name}`
      );
    }
  } catch (error) {
    logger.warn(
      { type: "backup_cleanup_error", error: (error as Error).message },
      "Failed to cleanup old backups"
    );
  }
}

/**
 * 创建项目备份（完整流程）
 */
export async function createProjectBackup(projectId: string): Promise<{
  success: boolean;
  filepath?: string;
  error?: string;
}> {
  try {
    const backup = await exportProject(projectId);
    const filepath = await saveBackupToFile(projectId, backup);
    await cleanupOldBackups(projectId, 5);

    return { success: true, filepath };
  } catch (error) {
    logger.error(
      {
        type: "backup_error",
        projectId,
        error: (error as Error).message,
      },
      `Backup failed for ${projectId}`
    );
    return { success: false, error: (error as Error).message };
  }
}
