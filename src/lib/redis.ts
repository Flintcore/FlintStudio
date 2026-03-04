import Redis from "ioredis";
import { env } from "./env";

function createRedis(options?: { maxRetriesPerRequest?: number | null }) {
  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    username: env.REDIS_USERNAME,
    tls: env.REDIS_TLS ? {} : undefined,
    ...options,
    retryStrategy(times) {
      return Math.min(2 ** Math.min(times, 10) * 100, 30_000);
    },
  });
}

const globalForRedis = globalThis as typeof globalThis & {
  __flintRedis?: { app: Redis; queue: Redis };
};

if (!globalForRedis.__flintRedis) {
  globalForRedis.__flintRedis = {
    app: createRedis({ maxRetriesPerRequest: 2 }),
    // BullMQ 要求 queue 连接的 maxRetriesPerRequest 为 null
    // 使用类型断言以满足 BullMQ 的类型要求
    queue: createRedis({ maxRetriesPerRequest: null }) as unknown as Redis,
  };
}

export const redis = globalForRedis.__flintRedis.app;
export const queueRedis = globalForRedis.__flintRedis.queue;
