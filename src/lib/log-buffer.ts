/**
 * 日志缓冲区 - 用于运行时日志查看
 * 保留最近 N 条日志记录
 */

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
}

const MAX_LOGS = 1000;
const logBuffer: LogEntry[] = [];

/**
 * 添加日志到缓冲区
 */
export function addToLogBuffer(level: string, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  logBuffer.push(entry);

  // 保持缓冲区大小限制
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }
}

/**
 * 获取日志条目
 */
export function getLogs(
  options: {
    level?: string;
    type?: string;
    limit?: number;
    since?: string;
  } = {}
): LogEntry[] {
  let logs = [...logBuffer];

  if (options.level) {
    logs = logs.filter((log) => log.level === options.level);
  }

  if (options.type && logs.length > 0) {
    logs = logs.filter((log) => log.context?.type === options.type);
  }

  if (options.since) {
    const sinceTime = new Date(options.since).getTime();
    logs = logs.filter((log) => new Date(log.timestamp).getTime() > sinceTime);
  }

  const limit = options.limit || 100;
  return logs.slice(-limit);
}

/**
 * 清空日志缓冲区
 */
export function clearLogs() {
  logBuffer.length = 0;
}

/**
 * 获取日志统计
 */
export function getLogStats(): {
  total: number;
  byLevel: Record<string, number>;
  byType: Record<string, number>;
} {
  const byLevel: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const log of logBuffer) {
    byLevel[log.level] = (byLevel[log.level] || 0) + 1;
    const type = log.context?.type as string;
    if (type) {
      byType[type] = (byType[type] || 0) + 1;
    }
  }

  return {
    total: logBuffer.length,
    byLevel,
    byType,
  };
}
