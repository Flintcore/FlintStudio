/**
 * API 路由日志工具
 * 用于记录 API 请求和响应
 */

import { logger } from "@/lib/logger";

interface LogApiRequestOptions {
  requestId: string;
  method: string;
  url: string;
  userId?: string;
}

interface LogApiResponseOptions {
  requestId: string;
  status: number;
  duration: number;
  error?: Error;
}

/**
 * 记录 API 请求开始
 */
export function logApiRequestStart(options: LogApiRequestOptions): void {
  logger.debug(
    {
      type: "api_request_start",
      requestId: options.requestId,
      method: options.method,
      url: options.url,
      userId: options.userId,
    },
    `API ${options.method} ${options.url} started`
  );
}

/**
 * 记录 API 响应完成
 */
export function logApiResponse(options: LogApiResponseOptions): void {
  const { requestId, status, duration, error } = options;

  const logData = {
    type: "api_response",
    requestId,
    status,
    duration,
    slow: duration > 1000,
  };

  if (error) {
    logger.error(
      { ...logData, error: error.message },
      `API request failed: ${error.message}`
    );
  } else if (status >= 500) {
    logger.error(logData, `API request returned ${status}`);
  } else if (status >= 400) {
    logger.warn(logData, `API request returned ${status}`);
  } else if (duration > 1000) {
    logger.warn(logData, `API request slow: ${duration}ms`);
  } else {
    logger.debug(logData, `API request completed in ${duration}ms`);
  }
}

/**
 * 创建 API 路由的日志包装器
 */
export function withApiLogging<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  options?: { name?: string }
): T {
  return (async (...args: unknown[]) => {
    const request = args[0] as Request;
    const requestId = crypto.randomUUID();
    const start = Date.now();

    logApiRequestStart({
      requestId,
      method: request.method,
      url: request.url,
    });

    try {
      const response = await handler(...args);
      const duration = Date.now() - start;

      logApiResponse({
        requestId,
        status: response.status,
        duration,
      });

      // 添加请求 ID 到响应头
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      newResponse.headers.set("x-request-id", requestId);

      return newResponse;
    } catch (error) {
      const duration = Date.now() - start;

      logApiResponse({
        requestId,
        status: 500,
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      throw error;
    }
  }) as T;
}
