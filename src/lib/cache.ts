/**
 * Redis 缓存层
 * 提供统一的缓存接口，支持 memory / redis 双模式
 */

import Redis from "ioredis";
import { logger } from "./logger";

// 简单的内存缓存（用于开发环境或 Redis 不可用时）
class MemoryCache {
  private store = new Map<string, { value: string; expiry: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiry > 0 && Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.store.get(key);
    if (!item) return false;
    if (item.expiry > 0 && Date.now() > item.expiry) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async flush(): Promise<void> {
    this.store.clear();
  }
}

// 统一的缓存接口
interface CacheInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  flush(): Promise<void>;
}

// 包装 Redis 以匹配统一接口
class RedisCache implements CacheInterface {
  constructor(private client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, "EX", ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async flush(): Promise<void> {
    await this.client.flushdb();
  }
}

// Redis 客户端
let cacheInstance: CacheInterface | null = null;

function getCache(): CacheInterface {
  if (cacheInstance) return cacheInstance;

  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;

  if (redisUrl) {
    try {
      const client = new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });

      client.on("error", (err) => {
        logger.warn({ type: "cache", error: err.message }, "Redis error");
      });

      cacheInstance = new RedisCache(client);
      logger.info({ type: "cache" }, "Using Redis cache");
      return cacheInstance;
    } catch (e) {
      logger.warn({ type: "cache", error: (e as Error).message }, "Failed to connect to Redis");
    }
  }

  cacheInstance = new MemoryCache();
  logger.info({ type: "cache" }, "Using memory cache");
  return cacheInstance;
}

// 缓存键前缀
const KEY_PREFIX = "flintstudio:";

/**
 * 获取缓存值
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const cache = getCache();
    const value = await cache.get(KEY_PREFIX + key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (e) {
    logger.debug({ type: "cache", key, error: (e as Error).message }, "Cache get failed");
    return null;
  }
}

/**
 * 设置缓存值
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = 300
): Promise<void> {
  try {
    const cache = getCache();
    await cache.set(KEY_PREFIX + key, JSON.stringify(value), ttlSeconds);
  } catch (e) {
    logger.debug({ type: "cache", key, error: (e as Error).message }, "Cache set failed");
  }
}

/**
 * 删除缓存
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    const cache = getCache();
    await cache.del(KEY_PREFIX + key);
  } catch (e) {
    logger.debug({ type: "cache", key, error: (e as Error).message }, "Cache del failed");
  }
}

/**
 * 检查缓存是否存在
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    const cache = getCache();
    return await cache.exists(KEY_PREFIX + key);
  } catch {
    return false;
  }
}

/**
 * 清空缓存
 */
export async function cacheFlush(): Promise<void> {
  try {
    const cache = getCache();
    await cache.flush();
  } catch (e) {
    logger.warn({ type: "cache", error: (e as Error).message }, "Cache flush failed");
  }
}

// 常用缓存键生成器
export const cacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userPrefs: (userId: string) => `user:${userId}:prefs`,
  project: (projectId: string) => `project:${projectId}`,
  projectList: (userId: string) => `user:${userId}:projects`,
  episode: (episodeId: string) => `episode:${episodeId}`,
  workflowRun: (runId: string) => `workflow:${runId}`,
  health: () => `system:health`,
};
