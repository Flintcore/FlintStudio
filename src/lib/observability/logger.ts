/**
 * 结构化日志
 * 支持 JSON 格式输出，便于日志收集和分析
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  component?: string;
  traceId?: string;
  spanId?: string;
  runId?: string;
  taskId?: string;
  userId?: string;
  projectId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
  duration?: number;
}

interface LoggerConfig {
  service: string;
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const DEFAULT_CONFIG: LoggerConfig = {
  service: "flintstudio",
  level: (process.env.LOG_LEVEL as LogLevel) || "info",
  enableConsole: true,
  enableFile: false,
};

class Logger {
  private config: LoggerConfig;
  private context: Partial<LogEntry> = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 设置上下文（如 traceId、userId 等）
   */
  setContext(context: Partial<LogEntry>): Logger {
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * 创建子 Logger（用于特定组件）
   */
  child(component: string): Logger {
    const childLogger = new Logger(this.config);
    childLogger.setContext({ ...this.context, component });
    return childLogger;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  private formatLogEntry(level: LogLevel, message: string, extra?: Partial<LogEntry>): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      ...this.context,
      ...extra,
    };
    return entry;
  }

  private output(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const levelColor: Record<LogLevel, string> = {
      debug: "\x1b[36m", // cyan
      info: "\x1b[32m",  // green
      warn: "\x1b[33m",  // yellow
      error: "\x1b[31m", // red
      fatal: "\x1b[35m", // magenta
    };
    const resetColor = "\x1b[0m";

    const color = levelColor[entry.level];
    const prefix = `${color}[${entry.level.toUpperCase()}]${resetColor}`;
    const context = [
      entry.traceId && `trace=${entry.traceId}`,
      entry.runId && `run=${entry.runId}`,
      entry.taskId && `task=${entry.taskId}`,
      entry.component && `component=${entry.component}`,
    ]
      .filter(Boolean)
      .join(" ");

    const logLine = context
      ? `${prefix} [${entry.timestamp}] [${context}] ${entry.message}`
      : `${prefix} [${entry.timestamp}] ${entry.message}`;

    if (entry.level === "error" || entry.level === "fatal") {
      console.error(logLine);
      if (entry.error?.stack) {
        console.error(entry.error.stack);
      }
    } else if (entry.level === "warn") {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }

    // 开发环境输出完整 JSON
    if (process.env.NODE_ENV === "development" && entry.metadata) {
      console.log(JSON.stringify(entry.metadata, null, 2));
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("debug")) return;
    const entry = this.formatLogEntry("debug", message, { metadata });
    this.output(entry);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("info")) return;
    const entry = this.formatLogEntry("info", message, { metadata });
    this.output(entry);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("warn")) return;
    const entry = this.formatLogEntry("warn", message, { metadata });
    this.output(entry);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("error")) return;
    const entry = this.formatLogEntry("error", message, {
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
      metadata,
    });
    this.output(entry);
  }

  fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog("fatal")) return;
    const entry = this.formatLogEntry("fatal", message, {
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
      metadata,
    });
    this.output(entry);
  }

  /**
   * 记录函数执行时间
   */
  async timed<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`${operation} completed`, { ...metadata, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${operation} failed`, error as Error, { ...metadata, duration });
      throw error;
    }
  }
}

// 全局 Logger 实例
export const logger = new Logger();

// 组件特定的 Logger
export const workflowLogger = logger.child("workflow");
export const taskLogger = logger.child("task");
export const agentLogger = logger.child("agent");
export const apiLogger = logger.child("api");
export const workerLogger = logger.child("worker");
