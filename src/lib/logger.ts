/**
 * 统一日志工具
 * 支持结构化日志输出，便于日志收集和分析
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function formatLog(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...context,
  };
  return JSON.stringify(logData);
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatLog("debug", message, context));
    }
  },

  info: (message: string, context?: LogContext) => {
    console.info(formatLog("info", message, context));
  },

  warn: (message: string, context?: LogContext) => {
    console.warn(formatLog("warn", message, context));
  },

  error: (message: string, error?: Error, context?: LogContext) => {
    console.error(
      formatLog("error", message, {
        ...context,
        error: error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
      })
    );
  },

  // 工作流专用日志
  workflow: {
    step: (step: string, runId: string, status: "start" | "complete" | "error", context?: LogContext) => {
      logger.info(`Workflow step ${step} ${status}`, {
        runId,
        step,
        status,
        ...context,
      });
    },

    task: (taskType: string, taskId: string, status: "queued" | "running" | "completed" | "failed", context?: LogContext) => {
      logger.info(`Task ${taskType} ${status}`, {
        taskId,
        taskType,
        status,
        ...context,
      });
    },
  },
};
