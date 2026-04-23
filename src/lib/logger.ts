/**
 * 结构化日志系统
 * 基于 Pino 的高性能日志，支持 JSON 输出和分级控制
 */

import pino from "pino";

// 日志级别从环境变量读取，默认 info
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

// 判断是否为开发环境
const isDev = process.env.NODE_ENV === "development";

// 创建 logger 实例
export const logger = pino({
  level: LOG_LEVEL,
  // 开发环境使用美化输出，生产使用 JSON
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  // 基础字段
  base: {
    env: process.env.NODE_ENV,
    version: process.env.npm_package_version || "0.56.0",
  },
});

/**
 * 创建带上下文的子 logger
 */
export function createContextLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * API 请求日志记录
 */
export function logRequest(
  req: { method: string; url: string; headers: { get: (name: string) => string | null } },
  res: { status: number },
  durationMs: number
) {
  const logData = {
    type: "request",
    method: req.method,
    url: req.url,
    status: res.status,
    duration: durationMs,
    userAgent: req.headers.get("user-agent"),
  };

  if (res.status >= 500) {
    logger.error(logData, "请求处理失败");
  } else if (res.status >= 400) {
    logger.warn(logData, "请求参数错误");
  } else if (durationMs > 1000) {
    logger.warn({ ...logData, slow: true }, "请求处理较慢");
  } else {
    logger.debug(logData, "请求处理完成");
  }
}

/**
 * Worker 任务日志
 */
export function logTask(
  taskType: string,
  taskId: string,
  status: "queued" | "running" | "completed" | "failed",
  context?: { duration?: number; error?: string; [key: string]: unknown }
) {
  const logData = {
    type: "task",
    taskType,
    taskId,
    status,
    ...context,
  };

  switch (status) {
    case "failed":
      logger.error(logData, `任务 ${taskType} 失败`);
      break;
    case "completed":
      logger.info(logData, `任务 ${taskType} 完成`);
      break;
    case "running":
      logger.debug(logData, `任务 ${taskType} 开始`);
      break;
    default:
      logger.debug(logData, `任务 ${taskType} 入队`);
  }
}

/**
 * 性能指标日志
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  context?: Record<string, unknown>
) {
  logger.debug(
    {
      type: "performance",
      operation,
      duration: durationMs,
      ...context,
    },
    `操作 ${operation} 耗时 ${durationMs}ms`
  );
}

/**
 * 错误日志
 */
export function logError(
  error: Error,
  context?: Record<string, unknown>
) {
  logger.error(
    {
      type: "error",
      error: {
        name: error.name,
        message: error.message,
        stack: isDev ? error.stack : undefined,
      },
      ...context,
    },
    error.message
  );
}

// 保持向后兼容的 workflow 日志
export const workflowLogger = {
  step: (step: string, runId: string, status: "start" | "complete" | "error", context?: Record<string, unknown>) => {
    const logData = { runId, step, status, type: "workflow_step", ...context };
    if (status === "error") {
      logger.error(logData, `Workflow step ${step} ${status}`);
    } else {
      logger.info(logData, `Workflow step ${step} ${status}`);
    }
  },

  task: (taskType: string, taskId: string, status: "queued" | "running" | "completed" | "failed", context?: Record<string, unknown>) => {
    logTask(taskType, taskId, status, context);
  },
};
