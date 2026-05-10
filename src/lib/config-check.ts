/**
 * 环境变量配置检查工具
 * 启动时验证关键配置，提供详细的错误信息和修复建议
 */

import { logger } from "./logger";

interface ConfigCheck {
  name: string;
  value: string | undefined;
  required: boolean;
  status: "ok" | "warning" | "error";
  message: string;
  suggestion?: string;
}

interface ConfigCheckResult {
  status: "ok" | "warning" | "error";
  checks: ConfigCheck[];
  summary: {
    total: number;
    ok: number;
    warnings: number;
    errors: number;
  };
}

/**
 * 检查数据库 URL 配置
 */
function checkDatabaseUrl(): ConfigCheck {
  const url = process.env.DATABASE_URL;

  if (!url) {
    return {
      name: "DATABASE_URL",
      value: undefined,
      required: true,
      status: "error",
      message: "数据库连接 URL 未配置",
      suggestion: "在 .env 文件中设置 DATABASE_URL=mysql://user:password@host:port/database",
    };
  }

  // 检查 URL 格式
  if (!url.startsWith("mysql://")) {
    return {
      name: "DATABASE_URL",
      value: maskCredentials(url),
      required: true,
      status: "error",
      message: "DATABASE_URL 必须以 mysql:// 开头",
      suggestion: "FlintStudio 仅支持 MySQL 数据库",
    };
  }

  // 检查连接池参数
  if (!url.includes("connection_limit=")) {
    return {
      name: "DATABASE_URL",
      value: maskCredentials(url),
      required: true,
      status: "warning",
      message: "未配置连接池大小",
      suggestion: "建议添加 ?connection_limit=20 以优化高并发场景",
    };
  }

  return {
    name: "DATABASE_URL",
    value: maskCredentials(url),
    required: true,
    status: "ok",
    message: "数据库 URL 配置正确",
  };
}

/**
 * 检查 NextAuth 密钥
 */
function checkNextAuthSecret(): ConfigCheck {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    return {
      name: "NEXTAUTH_SECRET",
      value: undefined,
      required: true,
      status: "error",
      message: "NextAuth 密钥未配置",
      suggestion: "运行 openssl rand -base64 32 生成一个安全的密钥",
    };
  }

  if (secret.length < 32) {
    return {
      name: "NEXTAUTH_SECRET",
      value: "***",
      required: true,
      status: "warning",
      message: "NextAuth 密钥长度不足 32 字符",
      suggestion: "建议使用至少 32 字符的随机密钥",
    };
  }

  return {
    name: "NEXTAUTH_SECRET",
    value: "***",
    required: true,
    status: "ok",
    message: "NextAuth 密钥配置正确",
  };
}

/**
 * 检查 Redis 连接
 */
function checkRedis(): ConfigCheck {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;

  if (!host) {
    return {
      name: "REDIS_HOST",
      value: undefined,
      required: true,
      status: "error",
      message: "Redis 主机未配置",
      suggestion: "设置 REDIS_HOST=localhost 或远程 Redis 地址",
    };
  }

  if (port && (parseInt(port, 10) < 1 || parseInt(port, 10) > 65535)) {
    return {
      name: "REDIS_PORT",
      value: port,
      required: false,
      status: "error",
      message: "Redis 端口无效",
      suggestion: "Redis 默认端口为 6379",
    };
  }

  return {
    name: "REDIS",
    value: `${host}:${port || "6379"}`,
    required: true,
    status: "ok",
    message: "Redis 配置正确",
  };
}

/**
 * 检查内部任务令牌
 */
function checkInternalToken(): ConfigCheck {
  const token = process.env.INTERNAL_TASK_TOKEN;

  if (!token) {
    return {
      name: "INTERNAL_TASK_TOKEN",
      value: undefined,
      required: false,
      status: "warning",
      message: "内部任务令牌未配置",
      suggestion: "可在用户设置中配置，或运行 openssl rand -hex 32 生成",
    };
  }

  if (token.length < 16) {
    return {
      name: "INTERNAL_TASK_TOKEN",
      value: "***",
      required: false,
      status: "warning",
      message: "内部任务令牌长度不足",
      suggestion: "建议使用至少 32 字符的随机令牌",
    };
  }

  return {
    name: "INTERNAL_TASK_TOKEN",
    value: "***",
    required: false,
    status: "ok",
    message: "内部任务令牌配置正确",
  };
}

/**
 * 检查数据目录
 */
function checkDataDir(): ConfigCheck {
  const dir = process.env.DATA_DIR;

  if (!dir) {
    return {
      name: "DATA_DIR",
      value: undefined,
      required: false,
      status: "warning",
      message: "数据目录未配置",
      suggestion: "设置 DATA_DIR=/path/to/data 用于存储视频和音频文件",
    };
  }

  return {
    name: "DATA_DIR",
    value: dir,
    required: false,
    status: "ok",
    message: "数据目录配置正确",
  };
}

/**
 * 检查 Worker 并发数
 */
function checkWorkerConcurrency(): ConfigCheck[] {
  const checks: ConfigCheck[] = [];
  const types = ["TEXT", "IMAGE", "VOICE", "VIDEO"];

  for (const type of types) {
    const key = `QUEUE_CONCURRENCY_${type}`;
    const value = process.env[key];

    if (value) {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        checks.push({
          name: key,
          value,
          required: false,
          status: "error",
          message: `${type} Worker 并发数无效`,
          suggestion: "设置为 1-10 之间的整数",
        });
      } else if (num > 20) {
        checks.push({
          name: key,
          value,
          required: false,
          status: "warning",
          message: `${type} Worker 并发数过高`,
          suggestion: "建议设置为 1-10 以避免资源耗尽",
        });
      } else {
        checks.push({
          name: key,
          value,
          required: false,
          status: "ok",
          message: `${type} Worker 并发数: ${num}`,
        });
      }
    }
  }

  return checks;
}

/**
 * 隐藏 URL 中的敏感信息
 */
function maskCredentials(url: string): string {
  return url.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
}

/**
 * 执行所有配置检查
 */
export function checkAllConfig(): ConfigCheckResult {
  const checks: ConfigCheck[] = [
    checkDatabaseUrl(),
    checkNextAuthSecret(),
    checkRedis(),
    checkInternalToken(),
    checkDataDir(),
    ...checkWorkerConcurrency(),
  ];

  const summary = {
    total: checks.length,
    ok: checks.filter((c) => c.status === "ok").length,
    warnings: checks.filter((c) => c.status === "warning").length,
    errors: checks.filter((c) => c.status === "error").length,
  };

  let status: "ok" | "warning" | "error" = "ok";
  if (summary.errors > 0) status = "error";
  else if (summary.warnings > 0) status = "warning";

  return { status, checks, summary };
}

/**
 * 格式化检查结果为人类可读的字符串
 */
export function formatCheckResult(result: ConfigCheckResult): string {
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push("FlintStudio 环境配置检查");
  lines.push("=".repeat(60));
  lines.push("");

  for (const check of result.checks) {
    const icon =
      check.status === "ok" ? "✓" : check.status === "warning" ? "⚠" : "✗";
    const name = check.name.padEnd(28);
    lines.push(`${icon} ${name} ${check.message}`);

    if (check.value !== undefined) {
      lines.push(`  当前值: ${check.value}`);
    }

    if (check.suggestion && check.status !== "ok") {
      lines.push(`  建议: ${check.suggestion}`);
    }
    lines.push("");
  }

  lines.push("-".repeat(60));
  lines.push(
    `总计: ${result.summary.total} | ✓ ${result.summary.ok} | ⚠ ${result.summary.warnings} | ✗ ${result.summary.errors}`
  );
  lines.push("=".repeat(60));

  return lines.join("\n");
}

/**
 * 启动时执行配置检查并记录到日志
 */
export function runStartupCheck(): boolean {
  const result = checkAllConfig();

  // 记录到日志
  logger.info(
    {
      type: "config_check",
      status: result.status,
      summary: result.summary,
    },
    `Configuration check: ${result.status}`
  );

  // 记录所有错误和警告
  for (const check of result.checks) {
    if (check.status === "error") {
      logger.error(
        {
          type: "config_error",
          name: check.name,
          suggestion: check.suggestion,
        },
        check.message
      );
    } else if (check.status === "warning") {
      logger.warn(
        {
          type: "config_warning",
          name: check.name,
          suggestion: check.suggestion,
        },
        check.message
      );
    }
  }

  // 如果有错误，应该阻止启动
  return result.summary.errors === 0;
}
