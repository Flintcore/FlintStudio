/**
 * 分布式追踪支持
 * 提供 Trace ID 生成和传播，便于跨 Agent 请求链路追踪
 */

import { AsyncLocalStorage } from "async_hooks";

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

// 使用 AsyncLocalStorage 实现上下文传递
const asyncLocalStorage = new AsyncLocalStorage<TraceContext>();

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取当前追踪上下文
 */
export function getCurrentTraceContext(): TraceContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * 生成新的 Trace ID
 */
export function generateTraceId(): string {
  return `trace-${generateId()}`;
}

/**
 * 生成新的 Span ID
 */
export function generateSpanId(): string {
  return `span-${generateId()}`;
}

/**
 * 在追踪上下文中执行函数
 */
export async function withTrace<T>(
  operationName: string,
  fn: (ctx: TraceContext) => Promise<T>,
  parentContext?: TraceContext,
  metadata?: Record<string, unknown>
): Promise<T> {
  const spanId = generateSpanId();
  const context: TraceContext = {
    traceId: parentContext?.traceId ?? generateTraceId(),
    spanId,
    parentSpanId: parentContext?.spanId,
    operationName,
    startTime: Date.now(),
    metadata: { ...parentContext?.metadata, ...metadata },
  };

  return asyncLocalStorage.run(context, async () => {
    const startTime = Date.now();
    try {
      const result = await fn(context);
      const duration = Date.now() - startTime;
      console.log(`[Trace] ${operationName} completed in ${duration}ms, traceId=${context.traceId}, spanId=${spanId}`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Trace] ${operationName} failed after ${duration}ms, traceId=${context.traceId}, spanId=${spanId}`, error);
      throw error;
    }
  });
}

/**
 * 为 HTTP 请求创建追踪中间件
 */
export function createTracingHeaders(context?: TraceContext): Record<string, string> {
  const ctx = context ?? getCurrentTraceContext();
  if (!ctx) return {};
  
  return {
    "X-Trace-ID": ctx.traceId,
    "X-Span-ID": ctx.spanId,
  };
}

/**
 * 从 HTTP 请求头中提取追踪上下文
 */
export function extractTraceContext(headers: Headers): Partial<TraceContext> | undefined {
  const traceId = headers.get("X-Trace-ID");
  const parentSpanId = headers.get("X-Span-ID");
  
  if (!traceId) return undefined;
  
  return {
    traceId,
    parentSpanId: parentSpanId ?? undefined,
    startTime: Date.now(),
  };
}

/**
 * 记录追踪日志
 */
export function traceLog(level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>): void {
  const context = getCurrentTraceContext();
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    traceId: context?.traceId,
    spanId: context?.spanId,
    operation: context?.operationName,
    ...extra,
  };
  
  const logMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logMethod(JSON.stringify(logEntry));
}
