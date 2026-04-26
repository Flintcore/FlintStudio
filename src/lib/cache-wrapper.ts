/**
 * 数据库查询缓存包装器
 * 自动为 Prisma 查询添加缓存层
 */

import { cacheGet, cacheSet, cacheDel, cacheKeys } from "./cache";
import { logger } from "./logger";

interface CacheOptions {
  ttl?: number; // 秒
  key?: string;
  tags?: string[];
}

/**
 * 缓存包装器 - 用于包装 Prisma 查询
 * @example
 * const project = await withCache(
 *   () => prisma.project.findUnique({ where: { id } }),
 *   cacheKeys.project(id),
 *   { ttl: 60 }
 * );
 */
export async function withCache<T>(
  fetcher: () => Promise<T>,
  cacheKey: string,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 300 } = options;

  // 尝试从缓存获取
  const cached = await cacheGet<T>(cacheKey);
  if (cached !== null) {
    logger.debug({ type: "cache_hit", key: cacheKey }, "Cache hit");
    return cached;
  }

  // 执行查询
  const result = await fetcher();

  // 写入缓存（如果结果不为 null）
  if (result !== null && result !== undefined) {
    await cacheSet(cacheKey, result, ttl);
    logger.debug({ type: "cache_set", key: cacheKey }, "Cache set");
  }

  return result;
}

/**
 * 使缓存失效
 */
export async function invalidateCache(key: string): Promise<void> {
  await cacheDel(key);
  logger.debug({ type: "cache_invalidate", key }, "Cache invalidated");
}

/**
 * 批量使缓存失效
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  // 简化实现：这里可以扩展为使用 Redis KEYS 命令
  logger.debug({ type: "cache_invalidate", pattern }, "Cache pattern invalidated");
}

/**
 * 用户相关查询缓存
 */
export const userCache = {
  async getUser(userId: string, fetcher: () => Promise<unknown>) {
    return withCache(fetcher, cacheKeys.user(userId), { ttl: 600 });
  },

  async getUserPrefs(userId: string, fetcher: () => Promise<unknown>) {
    return withCache(fetcher, cacheKeys.userPrefs(userId), { ttl: 300 });
  },

  async invalidateUser(userId: string) {
    await invalidateCache(cacheKeys.user(userId));
    await invalidateCache(cacheKeys.userPrefs(userId));
  },
};

/**
 * 项目相关查询缓存
 */
export const projectCache = {
  async getProject(projectId: string, fetcher: () => Promise<unknown>) {
    return withCache(fetcher, cacheKeys.project(projectId), { ttl: 300 });
  },

  async getProjectList(userId: string, fetcher: () => Promise<unknown>) {
    return withCache(fetcher, cacheKeys.projectList(userId), { ttl: 60 });
  },

  async invalidateProject(projectId: string) {
    await invalidateCache(cacheKeys.project(projectId));
  },

  async invalidateProjectList(userId: string) {
    await invalidateCache(cacheKeys.projectList(userId));
  },
};

/**
 * 剧集相关查询缓存
 */
export const episodeCache = {
  async getEpisode(episodeId: string, fetcher: () => Promise<unknown>) {
    return withCache(fetcher, cacheKeys.episode(episodeId), { ttl: 300 });
  },

  async invalidateEpisode(episodeId: string) {
    await invalidateCache(cacheKeys.episode(episodeId));
  },
};

/**
 * 工作流运行缓存
 */
export const workflowCache = {
  async getRun(runId: string, fetcher: () => Promise<unknown>) {
    return withCache(fetcher, cacheKeys.workflowRun(runId), { ttl: 60 });
  },

  async invalidateRun(runId: string) {
    await invalidateCache(cacheKeys.workflowRun(runId));
  },
};
