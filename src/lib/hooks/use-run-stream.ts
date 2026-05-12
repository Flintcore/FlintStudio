/**
 * SSE 订阅 Hook
 * 用于实时接收工作流进度更新
 */

import { useEffect, useRef, useState } from "react";

export interface RunSnapshot {
  runId: string;
  status: string;
  currentPhase: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  steps: Array<{
    stepKey: string;
    stepTitle: string;
    status: string;
    stepIndex: number;
    startedAt: string | null;
    finishedAt: string | null;
    errorMessage: string | null;
  }>;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

interface UseRunStreamOptions {
  enabled?: boolean;
  onComplete?: (snapshot: RunSnapshot) => void;
  onError?: (error: Error) => void;
}

interface UseRunStreamResult {
  snapshot: RunSnapshot | null;
  connected: boolean;
  error: string | null;
  reconnect: () => void;
}

/**
 * 订阅工作流运行实时进度
 */
export function useRunStream(
  runId: string | null,
  options: UseRunStreamOptions = {}
): UseRunStreamResult {
  const { enabled = true, onComplete, onError } = options;

  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = () => {
    if (!runId || !enabled || typeof window === "undefined") return;

    // 关闭已有连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/workflows/runs/${runId}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    es.addEventListener("snapshot", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as RunSnapshot;
        setSnapshot(data);
      } catch (e) {
        console.error("Failed to parse snapshot:", e);
      }
    });

    es.addEventListener("done", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as RunSnapshot;
        setSnapshot(data);
        onComplete?.(data);
      } catch (e) {
        console.error("Failed to parse done event:", e);
      }
      es.close();
      eventSourceRef.current = null;
      setConnected(false);
    });

    es.addEventListener("error", (event) => {
      const target = event as MessageEvent;
      if (target.data) {
        try {
          const data = JSON.parse(target.data);
          setError(data.message);
          onError?.(new Error(data.message));
        } catch {
          setError("连接错误");
        }
      }
    });

    es.onerror = () => {
      setConnected(false);

      // 自动重连（最多 3 次，间隔递增）
      if (reconnectAttemptsRef.current < 3 && eventSourceRef.current === es) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(2000 * reconnectAttemptsRef.current, 10000);
        setTimeout(() => {
          if (eventSourceRef.current === es) {
            es.close();
            connect();
          }
        }, delay);
      } else {
        setError("连接失败，请刷新页面重试");
        es.close();
        eventSourceRef.current = null;
      }
    };
  };

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, enabled]);

  return {
    snapshot,
    connected,
    error,
    reconnect: () => {
      reconnectAttemptsRef.current = 0;
      connect();
    },
  };
}
