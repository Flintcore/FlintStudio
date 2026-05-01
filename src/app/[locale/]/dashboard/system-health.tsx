"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Database,
  Server,
  HardDrive,
  Activity,
} from "lucide-react";

interface HealthStatus {
  database: {
    status: "healthy" | "degraded" | "unhealthy";
    latency: number;
    connections?: number;
  };
  redis: {
    status: "healthy" | "degraded" | "unhealthy";
    latency: number;
  };
  memory: {
    status: "healthy" | "degraded" | "unhealthy";
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    status: "healthy" | "degraded" | "unhealthy";
    used: number;
    total: number;
    percentage: number;
  };
}

export function SystemHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError("获取健康状态失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // 30秒刷新
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900";
      case "degraded":
        return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900";
      case "unhealthy":
        return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900";
      default:
        return "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800";
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">系统健康</h2>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-[var(--accent)]/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {health && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 数据库状态 */}
          <div
            className={`p-4 rounded-xl border ${getStatusClass(
              health.database.status
            )}`}
          >
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8" />
              <div className="flex-1">
                <p className="font-medium">数据库</p>
                <p className="text-sm text-[var(--muted)]">
                  延迟: {health.database.latency}ms
                </p>
              </div>
              {getStatusIcon(health.database.status)}
            </div>
          </div>

          {/* Redis 状态 */}
          <div
            className={`p-4 rounded-xl border ${getStatusClass(
              health.redis.status
            )}`}
          >
            <div className="flex items-center gap-3">
              <Server className="h-8 w-8" />
              <div className="flex-1">
                <p className="font-medium">Redis</p>
                <p className="text-sm text-[var(--muted)]">
                  延迟: {health.redis.latency}ms
                </p>
              </div>
              {getStatusIcon(health.redis.status)}
            </div>
          </div>

          {/* 内存状态 */}
          <div
            className={`p-4 rounded-xl border ${getStatusClass(
              health.memory.status
            )}`}
          >
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8" />
              <div className="flex-1">
                <p className="font-medium">内存</p>
                <div className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      health.memory.percentage > 80
                        ? "bg-red-500"
                        : health.memory.percentage > 60
                        ? "bg-amber-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${health.memory.percentage}%` }}
                  />
                </div>
                <p className="text-sm text-[var(--muted)] mt-1">
                  {Math.round(health.memory.used / 1024 / 1024)}MB /{" "}
                  {Math.round(health.memory.total / 1024 / 1024)}MB
                </p>
              </div>
              {getStatusIcon(health.memory.status)}
            </div>
          </div>

          {/* 磁盘状态 */}
          <div
            className={`p-4 rounded-xl border ${getStatusClass(
              health.disk.status
            )}`}
          >
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8" />
              <div className="flex-1">
                <p className="font-medium">磁盘</p>
                <div className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      health.disk.percentage > 80
                        ? "bg-red-500"
                        : health.disk.percentage > 60
                        ? "bg-amber-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${health.disk.percentage}%` }}
                  />
                </div>
                <p className="text-sm text-[var(--muted)] mt-1">
                  {Math.round(health.disk.used / 1024 / 1024 / 1024)}GB /{" "}
                  {Math.round(health.disk.total / 1024 / 1024 / 1024)}GB
                </p>
              </div>
              {getStatusIcon(health.disk.status)}
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-[var(--muted)]">
        上次更新: {lastUpdate.toLocaleTimeString("zh-CN")}
      </p>
    </section>
  );
}
