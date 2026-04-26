/**
 * 速率限制器
 * 基于内存的滑动窗口限流，防止 API 滥用
 */

import { cacheGet, cacheSet } from "./cache";
import { logger } from "./logger";

interface RateLimitConfig {
  windowMs: number;  // 时间窗口（毫秒）
  maxRequests: number;  // 窗口内最大请求数
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// 默认限流配置
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 分钟
  maxRequests: 100,
};

// 不同端点的限流配置
const ENDPOINT_CONFIGS: Record<string, RateLimitConfig> = {
  // 工作流启动 - 较严格
  "/api/workflows/run": { windowMs: 60 * 1000, maxRequests: 5 },
  // 图像生成 - 中等
  "/api/panels": { windowMs: 60 * 1000, maxRequests: 20 },
  // 默认 - 较宽松
  default: { windowMs: 60 * 1000, maxRequests: 100 },
};

function getClientIdentifier(request: Request): string {
  // 优先使用用户 ID（如果已认证）
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return `user:${authHeader.slice(7)}`;
  }

  // 否则使用 IP
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ||
             request.headers.get("x-real-ip") ||
             "unknown";

  return `ip:${ip}`;
}

function getEndpointConfig(pathname: string): RateLimitConfig {
  for (const [endpoint, config] of Object.entries(ENDPOINT_CONFIGS)) {
    if (pathname.startsWith(endpoint)) {
      return config;
    }
  }
  return ENDPOINT_CONFIGS.default;
}

/**
 * 检查速率限制
 */
export async function checkRateLimit(
  request: Request,
  customConfig?: RateLimitConfig
): Promise<RateLimitResult> {
  const identifier = getClientIdentifier(request);
  const { pathname } = new URL(request.url);
  const config = customConfig || getEndpointConfig(pathname);

  const key = `ratelimit:${identifier}:${pathname}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // 获取当前窗口内的请求记录
    const data = await cacheGet<{ timestamps: number[] }>(key);
    const timestamps = data?.timestamps || [];

    // 清理过期的记录
    const validTimestamps = timestamps.filter(t => t > windowStart);

    if (validTimestamps.length >= config.maxRequests) {
      const oldestTimestamp = validTimestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + config.windowMs - now) / 1000);

      logger.warn({
        type: "rate_limit_exceeded",
        identifier,
        pathname,
        count: validTimestamps.length,
      }, `Rate limit exceeded for ${pathname}`);

      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestTimestamp + config.windowMs,
        retryAfter,
      };
    }

    // 添加当前请求时间戳
    validTimestamps.push(now);
    await cacheSet(key, { timestamps: validTimestamps }, Math.ceil(config.windowMs / 1000));

    return {
      allowed: true,
      remaining: config.maxRequests - validTimestamps.length,
      resetTime: now + config.windowMs,
    };
  } catch (error) {
    // 缓存失败时允许请求通过，但记录错误
    logger.error({
      type: "rate_limit_error",
      error: (error as Error).message,
    }, "Rate limit check failed");

    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }
}

/**
 * 限流响应头
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.remaining + (result.retryAfter ? 0 : 1)),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
  };

  if (result.retryAfter) {
    headers["Retry-After"] = String(result.retryAfter);
  }

  return headers;
}
