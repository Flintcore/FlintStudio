/**
 * 统一的 API 错误处理工具
 * 提供标准化的错误响应格式和日志记录
 */

import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"           // 400
  | "UNAUTHORIZED"          // 401
  | "FORBIDDEN"             // 403
  | "NOT_FOUND"             // 404
  | "CONFLICT"              // 409
  | "RATE_LIMITED"          // 429
  | "INTERNAL_ERROR"        // 500
  | "SERVICE_UNAVAILABLE";  // 503

interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  timestamp: string;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  toJSON(requestId?: string): ApiErrorResponse {
    return {
      error: this.code,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
      requestId,
    };
  }
}

// 预定义的错误类型
export const Errors = {
  badRequest: (message = "请求参数无效", details?: unknown) =>
    new ApiError("BAD_REQUEST", message, 400, details),

  unauthorized: (message = "未登录或登录已过期") =>
    new ApiError("UNAUTHORIZED", message, 401),

  forbidden: (message = "没有权限执行此操作") =>
    new ApiError("FORBIDDEN", message, 403),

  notFound: (resource = "资源") =>
    new ApiError("NOT_FOUND", `${resource}不存在`, 404),

  conflict: (message = "资源冲突") =>
    new ApiError("CONFLICT", message, 409),

  rateLimited: (message = "请求过于频繁，请稍后重试") =>
    new ApiError("RATE_LIMITED", message, 429),

  internalError: (message = "服务器内部错误") =>
    new ApiError("INTERNAL_ERROR", message, 500),

  serviceUnavailable: (message = "服务暂时不可用") =>
    new ApiError("SERVICE_UNAVAILABLE", message, 503),
};

/**
 * 创建标准化的错误响应
 */
export function createErrorResponse(
  error: ApiError | Error,
  requestId?: string
): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(error.toJSON(requestId), {
      status: error.statusCode,
    });
  }

  // 未知错误
  return NextResponse.json(
    {
      error: "INTERNAL_ERROR",
      code: "INTERNAL_ERROR",
      message: error.message || "服务器内部错误",
      timestamp: new Date().toISOString(),
      requestId,
    },
    { status: 500 }
  );
}

/**
 * 统一的 API 路由处理器包装器
 */
export function withErrorHandler<T extends (...args: unknown[]) => Promise<NextResponse>>(
  handler: T,
  options: { logErrors?: boolean; requestId?: () => string } = {}
): T {
  return (async (...args: unknown[]) => {
    const requestId = options.requestId?.() ?? crypto.randomUUID();
    try {
      return await handler(...args);
    } catch (error) {
      if (options.logErrors !== false) {
        console.error(`[API Error] RequestId: ${requestId}`, error);
      }
      return createErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        requestId
      );
    }
  }) as T;
}

/**
 * 安全解析 JSON
 */
export async function safeParseJson<T = unknown>(
  req: Request,
  options: { maxSize?: number } = {}
): Promise<T | null> {
  try {
    // 检查内容长度
    const contentLength = req.headers.get("content-length");
    if (contentLength && options.maxSize) {
      const size = parseInt(contentLength, 10);
      if (size > options.maxSize) {
        throw Errors.badRequest(`请求体超过最大限制 ${options.maxSize} 字节`);
      }
    }

    const text = await req.text();

    // 检查大小
    if (options.maxSize && text.length > options.maxSize) {
      throw Errors.badRequest(`请求体超过最大限制 ${options.maxSize} 字符`);
    }

    if (!text.trim()) {
      return null;
    }

    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof SyntaxError) {
      throw Errors.badRequest("无效的 JSON 格式");
    }
    throw Errors.badRequest("无法解析请求体");
  }
}

/**
 * 验证必需字段
 */
export function requireFields(
  data: Record<string, unknown>,
  fields: string[]
): void {
  const missing = fields.filter((f) => {
    const value = data[f];
    return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
  });

  if (missing.length > 0) {
    throw Errors.badRequest(`缺少必需字段: ${missing.join(", ")}`, { missing });
  }
}

/**
 * 验证字符串长度
 */
export function validateLength(
  value: string,
  fieldName: string,
  options: { min?: number; max?: number }
): void {
  if (options.min !== undefined && value.length < options.min) {
    throw Errors.badRequest(`${fieldName} 长度不能少于 ${options.min} 字符`);
  }
  if (options.max !== undefined && value.length > options.max) {
    throw Errors.badRequest(`${fieldName} 长度不能超过 ${options.max} 字符`);
  }
}

/**
 * 验证 UUID 格式
 */
export function validateUUID(value: string, fieldName = "ID"): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw Errors.badRequest(`无效的 ${fieldName} 格式`);
  }
}
