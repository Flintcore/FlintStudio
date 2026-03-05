/**
 * 通用重试工具
 * 支持指数退避、自定义重试条件、超时控制
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  timeout?: number;
  retryableErrors?: string[];
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  timeout: 60000,
  retryableErrors: [],
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * 计算指数退避延迟
 */
function calculateBackoffDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  return Math.min(delay, options.maxDelay);
}

/**
 * 添加随机抖动，避免惊群效应
 */
function addJitter(delay: number): number {
  const jitter = delay * 0.1 * (Math.random() - 0.5);
  return delay + jitter;
}

/**
 * 带重试的函数包装器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // 创建超时 Promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`操作超时 (${opts.timeout}ms)`)), opts.timeout);
      });

      // 竞争执行
      return await Promise.race([fn(), timeoutPromise]);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 检查是否应该重试
      if (attempt === opts.maxAttempts) {
        break;
      }

      // 自定义重试判断
      if (opts.shouldRetry && !opts.shouldRetry(lastError)) {
        throw lastError;
      }

      // 检查错误类型是否可重试
      if (opts.retryableErrors.length > 0) {
        const errorMessage = lastError.message.toLowerCase();
        const isRetryable = opts.retryableErrors.some((e) => errorMessage.includes(e.toLowerCase()));
        if (!isRetryable) {
          throw lastError;
        }
      }

      // 触发重试回调
      opts.onRetry(lastError, attempt);

      // 计算并等待退避时间
      const delay = addJitter(calculateBackoffDelay(attempt, opts));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error("重试次数耗尽");
}

/**
 * HTTP 请求专用重试配置
 */
export const HTTP_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  timeout: 60000,
  retryableErrors: [
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ENOTFOUND",
    "socket hang up",
    "network error",
    "timeout",
    "rate limit",
    "too many requests",
    "429",
    "502",
    "503",
    "504",
  ],
  shouldRetry: (error) => {
    const message = error.message.toLowerCase();
    // 不重试 4xx 错误（除 429 外）
    if (/\b4\d\d\b/.test(message) && !message.includes("429")) {
      return false;
    }
    return true;
  },
};

/**
 * LLM API 专用重试配置
 */
export const LLM_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  initialDelay: 2000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  timeout: 120000,
  retryableErrors: [
    "rate limit",
    "too many requests",
    "429",
    "timeout",
    "gateway",
    "overloaded",
    "temporarily unavailable",
    "503",
    "502",
    "504",
  ],
  shouldRetry: (error) => {
    const message = error.message.toLowerCase();
    // 不重试认证错误
    if (message.includes("401") || message.includes("403") || message.includes("invalid api key")) {
      return false;
    }
    // 不重试格式错误
    if (message.includes("400") && !message.includes("rate")) {
      return false;
    }
    return true;
  },
  onRetry: (error, attempt) => {
    console.warn(`[LLM Retry] 第 ${attempt} 次重试，错误: ${error.message}`);
  },
};

/**
 * 图像生成专用重试配置
 */
export const IMAGE_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 3000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  timeout: 120000,
  retryableErrors: [
    "rate limit",
    "timeout",
    "content policy",
    "safety",
    "429",
    "503",
    "504",
  ],
  shouldRetry: (error) => {
    const message = error.message.toLowerCase();
    // 不重试内容策略违规
    if (message.includes("content_policy_violation") || message.includes("safety")) {
      return false;
    }
    return true;
  },
};

/**
 * 断路器模式实现
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number | null;
  isOpen: boolean;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: null,
    isOpen: false,
  };

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeout = 60000,
    private readonly name = "CircuitBreaker"
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.isOpen) {
      const now = Date.now();
      const lastFailure = this.state.lastFailureTime ?? 0;

      if (now - lastFailure < this.resetTimeout) {
        throw new Error(
          `[${this.name}] 断路器已打开，服务暂时不可用，请 ${Math.ceil(
            (this.resetTimeout - (now - lastFailure)) / 1000
          )} 秒后重试`
        );
      }

      // 半开状态，尝试恢复
      console.log(`[${this.name}] 断路器半开，尝试恢复服务`);
      this.state.isOpen = false;
      this.state.failures = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.state.failures = 0;
    this.state.isOpen = false;
  }

  private onFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failures >= this.failureThreshold) {
      this.state.isOpen = true;
      console.error(
        `[${this.name}] 断路器已打开，连续失败 ${this.state.failures} 次`
      );
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}
