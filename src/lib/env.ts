/**
 * 环境变量验证模块
 * 在应用启动时验证必要的环境变量
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`缺少必要的环境变量: ${name}`);
  }
  return value;
}

function warnEnv(name: string, message: string): void {
  const value = process.env[name];
  if (!value || value.trim() === "" || value.includes("please-change")) {
    console.warn(`[EnvWarning] ${name}: ${message}`);
  }
}

export function validateEnv(): void {
  // 必要变量
  const databaseUrl = requireEnv("DATABASE_URL");
  
  // 验证 DATABASE_URL 格式
  if (!databaseUrl.startsWith("mysql://") && !databaseUrl.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL 必须是有效的 MySQL 或 PostgreSQL 连接字符串");
  }

  // 警告未修改的默认值
  warnEnv("NEXTAUTH_SECRET", "请修改为随机字符串，不要使用默认值");
  warnEnv("INTERNAL_TASK_TOKEN", "请修改为随机字符串，用于 Worker 内部通信");
  warnEnv("CRON_SECRET", "请修改为随机字符串");
  warnEnv("API_ENCRYPTION_KEY", "请修改为随机字符串");

  // 验证 URL 格式
  const nextauthUrl = process.env.NEXTAUTH_URL;
  if (nextauthUrl) {
    try {
      new URL(nextauthUrl);
    } catch {
      throw new Error("NEXTAUTH_URL 必须是有效的 URL");
    }
  }

  // 验证 Redis 端口
  const redisPort = process.env.REDIS_PORT;
  if (redisPort) {
    const port = parseInt(redisPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error("REDIS_PORT 必须是有效的端口号 (1-65535)");
    }
  }

  // 验证并发配置
  const concurrencyVars = [
    "QUEUE_CONCURRENCY_IMAGE",
    "QUEUE_CONCURRENCY_VIDEO",
    "QUEUE_CONCURRENCY_VOICE",
    "QUEUE_CONCURRENCY_TEXT",
  ];
  for (const name of concurrencyVars) {
    const val = process.env[name];
    if (val) {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1) {
        throw new Error(`${name} 必须是正整数`);
      }
    }
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || "",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "",
  INTERNAL_TASK_TOKEN: process.env.INTERNAL_TASK_TOKEN || "",
  CRON_SECRET: process.env.CRON_SECRET || "",
  API_ENCRYPTION_KEY: process.env.API_ENCRYPTION_KEY || "",
  REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",
  REDIS_PORT: parseInt(process.env.REDIS_PORT || "6379", 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  REDIS_USERNAME: process.env.REDIS_USERNAME || undefined,
  REDIS_TLS: process.env.REDIS_TLS === "true",
  STORAGE_TYPE: process.env.STORAGE_TYPE || "local",
  DATA_DIR: process.env.DATA_DIR || "",
  WATCHDOG_INTERVAL_MS: parseInt(process.env.WATCHDOG_INTERVAL_MS || "30000", 10),
  TASK_HEARTBEAT_TIMEOUT_MS: parseInt(process.env.TASK_HEARTBEAT_TIMEOUT_MS || "90000", 10),
  QUEUE_CONCURRENCY_IMAGE: parseInt(process.env.QUEUE_CONCURRENCY_IMAGE || "4", 10),
  QUEUE_CONCURRENCY_VIDEO: parseInt(process.env.QUEUE_CONCURRENCY_VIDEO || "2", 10),
  QUEUE_CONCURRENCY_VOICE: parseInt(process.env.QUEUE_CONCURRENCY_VOICE || "4", 10),
  QUEUE_CONCURRENCY_TEXT: parseInt(process.env.QUEUE_CONCURRENCY_TEXT || "4", 10),
} as const;
