/**
 * 简单的内存缓存工具
 * 用于缓存 API 响应和频繁查询的数据
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number;

  constructor(defaultTTLMs = 60000) {
    // 默认 1 分钟
    this.defaultTTL = defaultTTLMs;
    // 定期清理过期条目
    setInterval(() => this.cleanup(), 300000); // 每 5 分钟清理一次
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

// 全局缓存实例
export const apiCache = new MemoryCache(30000); // API 响应缓存 30 秒
export const dbCache = new MemoryCache(60000); // 数据库查询缓存 1 分钟

/**
 * 缓存包装器 - 用于函数结果缓存
 */
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    keyPrefix: string;
    ttlMs?: number;
    cache: MemoryCache;
  }
): T {
  return (async (...args: unknown[]) => {
    const cacheKey = `${options.keyPrefix}:${JSON.stringify(args)}`;
    const cached = options.cache.get<ReturnType<T>>(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const result = (await fn(...args)) as ReturnType<T>;
    options.cache.set(cacheKey, result, options.ttlMs);
    return result;
  }) as T;
}

/**
 * 为特定用户缓存包装器
 */
export function withUserCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    ttlMs?: number;
    cache?: MemoryCache;
  } = {}
): (userId: string, ...args: Parameters<T>) => Promise<ReturnType<T>> {
  const cache = options.cache ?? dbCache;

  return async (userId: string, ...args: unknown[]) => {
    const cacheKey = `${fn.name}:${userId}:${JSON.stringify(args)}`;
    const cached = cache.get<ReturnType<T>>(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const result = (await fn(userId, ...args)) as ReturnType<T>;
    cache.set(cacheKey, result, options.ttlMs);
    return result;
  };
}
