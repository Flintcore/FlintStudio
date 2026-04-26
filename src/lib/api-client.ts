/**
 * API 客户端工具
 * 统一的请求封装，支持错误处理和重试
 */

import { logger } from "./logger";

interface ApiClientOptions {
  baseUrl?: string;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface RequestConfig extends RequestInit {
  timeout?: number;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class ApiClient {
  private baseUrl: string;
  private retries: number;
  private retryDelay: number;
  private defaultTimeout: number;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || "";
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.defaultTimeout = options.timeout || 30000;
  }

  private async fetchWithTimeout(
    url: string,
    config: RequestConfig
  ): Promise<Response> {
    const timeout = config.timeout || this.defaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async retry<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= this.retries) {
        throw error;
      }

      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      logger.debug(
        { type: "api_retry", attempt, delay },
        `Retrying API call, attempt ${attempt}`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retry(fn, attempt + 1);
    }
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();

    return this.retry(async () => {
      try {
        const response = await this.fetchWithTimeout(url, {
          headers: {
            "Content-Type": "application/json",
            ...config.headers,
          },
          ...config,
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          logger.warn(
            {
              type: "api_error",
              url,
              status: response.status,
              duration,
            },
            `API error: ${response.status}`
          );
          throw new ApiError(
            errorData.message || `HTTP ${response.status}`,
            response.status,
            errorData
          );
        }

        logger.debug(
          {
            type: "api_success",
            url,
            duration,
          },
          `API success: ${url}`
        );

        // 处理 204 No Content
        if (response.status === 204) {
          return undefined as T;
        }

        return response.json() as Promise<T>;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        if ((error as Error).name === "AbortError") {
          throw new ApiError("请求超时", 408);
        }

        throw new ApiError((error as Error).message, 0);
      }
    });
  }

  get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "GET" });
  }

  post<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "DELETE" });
  }
}

// 默认 API 客户端实例
export const apiClient = new ApiClient({
  retries: 3,
  retryDelay: 1000,
  timeout: 30000,
});

export { ApiError };
export type { ApiClientOptions, RequestConfig };
