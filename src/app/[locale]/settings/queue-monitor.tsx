"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
} from "lucide-react";

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface WorkerStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  timeoutTasks: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  errorsByType: Record<string, number>;
  activeTasks: number;
}

interface QueueData {
  queues: {
    text: QueueStatus;
    image: QueueStatus;
    voice: QueueStatus;
    video: QueueStatus;
  };
  summary: {
    totalWaiting: number;
    totalActive: number;
    totalFailed: number;
    totalCompleted: number;
  };
  workers: WorkerStats;
  activeTasks: Array<{
    taskType: string;
    taskId: string;
    startTime: number;
    status: string;
  }>;
}

export function QueueMonitor() {
  const t = useTranslations("settings");
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/queues");
      if (!res.ok) throw new Error("获取队列状态失败");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const controlQueue = async (
    action: "pause" | "resume" | "clean",
    queue: string
  ) => {
    setActionLoading(`${action}-${queue}`);
    try {
      const res = await fetch("/api/admin/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, queue }),
      });
      if (!res.ok) throw new Error("操作失败");
      await fetchData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        </div>
      </section>
    );
  }

  const queueList = data ? Object.values(data.queues) : [];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">
            {t("queues.title", { default: "队列监控" })}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t("queues.autoRefresh", { default: "自动刷新" })}
          </label>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-[var(--accent)]/10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 总体统计 */}
      {data && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
            <div className="text-2xl font-semibold text-blue-600">
              {data.summary.totalWaiting}
            </div>
            <div className="text-xs text-gray-500">等待中</div>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
            <div className="text-2xl font-semibold text-amber-600">
              {data.summary.totalActive}
            </div>
            <div className="text-xs text-gray-500">处理中</div>
          </div>
          <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center">
            <div className="text-2xl font-semibold text-green-600">
              {data.workers.completedTasks}
            </div>
            <div className="text-xs text-gray-500">已完成</div>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
            <div className="text-2xl font-semibold text-red-600">
              {data.summary.totalFailed}
            </div>
            <div className="text-xs text-gray-500">失败</div>
          </div>
        </div>
      )}

      {/* Worker 统计 */}
      {data?.workers && (
        <div className="mt-6 rounded-lg border border-[var(--border)] p-4">
          <h3 className="text-sm font-medium mb-3">Worker 统计</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[var(--muted)]">平均处理时间:</span>
              <span className="ml-1 font-medium">
                {Math.round(data.workers.avgDuration)}ms
              </span>
            </div>
            <div>
              <span className="text-[var(--muted)]">最大处理时间:</span>
              <span className="ml-1 font-medium">
                {Math.round(data.workers.maxDuration)}ms
              </span>
            </div>
            <div>
              <span className="text-[var(--muted)]">超时任务:</span>
              <span className="ml-1 font-medium">{data.workers.timeoutTasks}</span>
            </div>
            <div>
              <span className="text-[var(--muted)]">活跃任务:</span>
              <span className="ml-1 font-medium">{data.workers.activeTasks}</span>
            </div>
          </div>
        </div>
      )}

      {/* 队列列表 */}
      <div className="mt-6 space-y-3">
        {queueList.map((queue) => (
          <div
            key={queue.name}
            className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {queue.paused ? (
                  <Pause className="h-4 w-4 text-amber-500" />
                ) : (
                  <Play className="h-4 w-4 text-green-500" />
                )}
                <span className="font-medium capitalize">{queue.name}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1 text-blue-600">
                  <Clock className="h-3 w-3" />
                  {queue.waiting}
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Loader2 className="h-3 w-3" />
                  {queue.active}
                </span>
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  {queue.completed}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  {queue.failed}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  controlQueue(queue.paused ? "resume" : "pause", queue.name)
                }
                disabled={!!actionLoading}
                className="p-2 rounded-lg hover:bg-[var(--accent)]/10 disabled:opacity-50"
                title={queue.paused ? "恢复" : "暂停"}
              >
                {actionLoading === `${queue.paused ? "resume" : "pause"}-${queue.name}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : queue.paused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => controlQueue("clean", queue.name)}
                disabled={!!actionLoading}
                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/30 text-red-600 disabled:opacity-50"
                title="清理已完成/失败任务"
              >
                {actionLoading === `clean-${queue.name}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 活跃任务 */}
      {data?.activeTasks && data.activeTasks.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-3">活跃任务</h3>
          <div className="space-y-2">
            {data.activeTasks.map((task) => (
              <div
                key={task.taskId}
                className="flex items-center justify-between p-2 rounded bg-[var(--background)] text-sm"
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" />
                  <span className="font-medium">{task.taskType}</span>
                  <span className="text-[var(--muted)] text-xs">{task.taskId.slice(0, 8)}</span>
                </div>
                <span className="text-[var(--muted)] text-xs">
                  {Math.round((Date.now() - task.startTime) / 1000)}s
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}
