/**
 * 统一错误处理工具
 */

import { logger } from "@/lib/logger";

export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function handleError(error: unknown, context?: string): AppError {
  // 已经是 AppError 格式
  if (isAppError(error)) {
    return error;
  }

  // Error 对象
  if (error instanceof Error) {
    logger.error(context || "Error occurred", error);
    return {
      code: "INTERNAL_ERROR",
      message: error.message,
    };
  }

  // 字符串错误
  if (typeof error === "string") {
    return {
      code: "INTERNAL_ERROR",
      message: error,
    };
  }

  // 未知错误
  logger.error("Unknown error", undefined, { error, context });
  return {
    code: "UNKNOWN_ERROR",
    message: "An unknown error occurred",
  };
}

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

/**
 * 包装异步函数，统一错误处理
 */
export function withErrorHandler<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<{ success: true; data: T } | { success: false; error: AppError }> {
  return fn()
    .then((data) => ({ success: true as const, data }))
    .catch((err) => ({ success: false as const, error: handleError(err, context) }));
}
