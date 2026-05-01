"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Clock,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface MetricsData {
  queues: {
    totalWaiting: number;
    totalActive: number;
    totalCompleted: number;
    totalFailed: number;
  };
  workers: {
    completedTasks: number;
    failedTasks: number;
    timeoutTasks: number;
    avgDuration: number;
    activeTasks: number;
  };
  requests: {
    total: number;
    avgResponseTime: number;
    errorRate: number;
  };
}

export function PerformanceMetrics() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/admin/queues");
        if (res.ok) {
          const data = await res.json();
          setMetrics({
            queues: data.summary,
            workers: data.workers,
            requests: {
              total: data.workers.totalTasks,
              avgResponseTime: data.workers.avgDuration,
              errorRate:
                data.workers.totalTasks > 0
                  ? (data.workers.failedTasks / data.workers.totalTasks) * 100
                  : 0,
            },
          });
        }
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[var(--accent)]" />
        <h2 className="text-lg font-semibold">性能指标</h2>
      </div>

      {metrics && (
        <div className="mt-4 space-y-6">
          {/* 队列统计 */}
          <div>
            <h3 className="text-sm font-medium text-[var(--muted)] mb-3">
              任务队列
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-semibold text-blue-600">
                  {metrics.queues.totalWaiting}
                </p>
                <p className="text-xs text-[var(--muted)]">等待中</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-amber-600">
                  {metrics.queues.totalActive}
                </p>
                <p className="text-xs text-[var(--muted)]">处理中</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-green-600">
                  {metrics.workers.completedTasks}
                </p>
                <p className="text-xs text-[var(--muted)]">已完成</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-red-600">
                  {metrics.workers.failedTasks}
                </p>
                <p className="text-xs text-[var(--muted)]">失败</p>
              </div>
            </div>
          </div>

          {/* Worker 性能 */}
          <div>
            <h3 className="text-sm font-medium text-[var(--muted)] mb-3">
              Worker 性能
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-[var(--background)]">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[var(--muted)]" />
                  <span className="text-sm text-[var(--muted)]">平均处理时间</span>
                </div>
                <p className="mt-1 text-xl font-semibold">
                  {Math.round(metrics.workers.avgDuration)}ms
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--background)]">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[var(--muted)]" />
                  <span className="text-sm text-[var(--muted)]">吞吐量</span>
                </div>
                <p className="mt-1 text-xl font-semibold">
                  {metrics.workers.completedTasks}
                  <span className="text-sm font-normal text-[var(--muted)]">
                    {" "}
                    任务
                  </span>
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--background)]">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      metrics.requests.errorRate > 5
                        ? "text-red-500"
                        : "text-[var(--muted)]"
                    }`}
                  />
                  <span className="text-sm text-[var(--muted)]">错误率</span>
                </div>
                <p
                  className={`mt-1 text-xl font-semibold ${
                    metrics.requests.errorRate > 5 ? "text-red-600" : ""
                  }`}
                >
                  {metrics.requests.errorRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* 超时任务警告 */}
          {metrics.workers.timeoutTasks > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  有 {metrics.workers.timeoutTasks} 个任务超时
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
