import Redis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number.parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

function createRedis(options?: { maxRetriesPerRequest: number | null }) {
  return new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
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
    queue: createRedis({ maxRetriesPerRequest: null as unknown as number }),
  };
}

export const redis = globalForRedis.__flintRedis.app;
export const queueRedis = globalForRedis.__flintRedis.queue;
