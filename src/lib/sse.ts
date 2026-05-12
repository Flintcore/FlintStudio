/**
 * Server-Sent Events 工具
 * 用于实时推送任务进度
 */

/**
 * 格式化 SSE 消息
 * @param data 数据对象
 * @param event 事件类型（可选）
 * @param id 消息 ID（可选）
 */
export function formatSSE(
  data: unknown,
  event?: string,
  id?: string | number
): string {
  const lines: string[] = [];

  if (id !== undefined) {
    lines.push(`id: ${id}`);
  }
  if (event) {
    lines.push(`event: ${event}`);
  }

  // 数据可能是多行，每行都要 data: 前缀
  const dataStr = typeof data === "string" ? data : JSON.stringify(data);
  for (const line of dataStr.split("\n")) {
    lines.push(`data: ${line}`);
  }

  return lines.join("\n") + "\n\n";
}

/**
 * 创建 SSE 心跳消息（防止连接超时）
 */
export function formatSSEHeartbeat(): string {
  return `: heartbeat ${Date.now()}\n\n`;
}

/**
 * SSE 响应配置
 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no", // 禁用 Nginx 缓冲
};

/**
 * 创建一个可控的 SSE 流
 */
export class SSEStream {
  private encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private closed = false;

  /**
   * 创建可读流
   */
  createStream(options: {
    onStart?: (stream: SSEStream) => void | Promise<void>;
    onCancel?: () => void | Promise<void>;
    heartbeatMs?: number;
  } = {}): ReadableStream<Uint8Array> {
    const { onStart, onCancel, heartbeatMs = 30000 } = options;

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        this.controller = controller;

        // 启动心跳
        if (heartbeatMs > 0) {
          this.heartbeatInterval = setInterval(() => {
            this.sendRaw(formatSSEHeartbeat());
          }, heartbeatMs);
        }

        // 调用初始化回调
        if (onStart) {
          try {
            await onStart(this);
          } catch (error) {
            this.error(error as Error);
          }
        }
      },
      cancel: async () => {
        this.cleanup();
        if (onCancel) {
          await onCancel();
        }
      },
    });
  }

  /**
   * 发送事件
   */
  send(data: unknown, event?: string, id?: string | number): void {
    if (this.closed || !this.controller) return;

    try {
      this.controller.enqueue(this.encoder.encode(formatSSE(data, event, id)));
    } catch {
      this.closed = true;
    }
  }

  /**
   * 发送原始字符串
   */
  sendRaw(text: string): void {
    if (this.closed || !this.controller) return;

    try {
      this.controller.enqueue(this.encoder.encode(text));
    } catch {
      this.closed = true;
    }
  }

  /**
   * 发送错误
   */
  error(err: Error): void {
    this.send({ message: err.message }, "error");
    this.close();
  }

  /**
   * 关闭流
   */
  close(): void {
    this.cleanup();
    if (this.controller) {
      try {
        this.controller.close();
      } catch {
        // ignore
      }
      this.controller = null;
    }
  }

  private cleanup() {
    this.closed = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  isClosed(): boolean {
    return this.closed;
  }
}
