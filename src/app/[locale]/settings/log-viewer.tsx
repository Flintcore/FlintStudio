"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
}

interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  byType: Record<string, number>;
}

export function LogViewer() {
  const t = useTranslations("settings");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [level, setLevel] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const logsEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (level) params.set("level", level);
      if (type) params.set("type", type);
      params.set("limit", "200");
      params.set("stats", "true");

      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      if (!res.ok) throw new Error("清空失败");
      setLogs([]);
      setStats({ total: 0, byLevel: {}, byType: {} });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    fetchLogs();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, level, type]);

  useEffect(() => {
    if (autoRefresh && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoRefresh]);

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpanded(newExpanded);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
      case "fatal":
        return "text-red-600 dark:text-red-400";
      case "warn":
        return "text-amber-600 dark:text-amber-400";
      case "info":
        return "text-blue-600 dark:text-blue-400";
      case "debug":
      case "trace":
        return "text-gray-500 dark:text-gray-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case "error":
      case "fatal":
        return "bg-red-50 dark:bg-red-950/30";
      case "warn":
        return "bg-amber-50 dark:bg-amber-950/30";
      case "info":
        return "bg-blue-50 dark:bg-blue-950/30";
      default:
        return "";
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("logs.title", { default: "系统日志" })}</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t("logs.autoRefresh", { default: "自动刷新" })}
          </label>
        </div>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 text-center">
            <div className="text-2xl font-semibold">{stats.total}</div>
            <div className="text-xs text-gray-500">{t("logs.total", { default: "总计" })}</div>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
            <div className="text-2xl font-semibold text-red-600">{stats.byLevel.error || 0}</div>
            <div className="text-xs text-gray-500">{t("logs.errors", { default: "错误" })}</div>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
            <div className="text-2xl font-semibold text-amber-600">{stats.byLevel.warn || 0}</div>
            <div className="text-xs text-gray-500">{t("logs.warnings", { default: "警告" })}</div>
          </div>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
            <div className="text-2xl font-semibold text-blue-600">{stats.byType.task || 0}</div>
            <div className="text-xs text-gray-500">{t("logs.tasks", { default: "任务" })}</div>
          </div>
        </div>
      )}

      {/* 过滤器 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
        >
          <option value="">{t("logs.allLevels", { default: "所有级别" })}</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
          <option value="trace">Trace</option>
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
        >
          <option value="">{t("logs.allTypes", { default: "所有类型" })}</option>
          <option value="request">Request</option>
          <option value="task">Task</option>
          <option value="performance">Performance</option>
          <option value="workflow_step">Workflow</option>
          <option value="error">Error</option>
        </select>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="rounded-md bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? t("logs.refreshing", { default: "刷新中..." }) : t("logs.refresh", { default: "刷新" })}
        </button>

        <button
          onClick={clearLogs}
          className="rounded-md bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-950"
        >
          {t("logs.clear", { default: "清空" })}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 日志列表 */}
      <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] font-mono text-xs">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {t("logs.empty", { default: "暂无日志" })}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer ${getLevelBg(log.level)}`}
                onClick={() => toggleExpand(index)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString("zh-CN")}
                  </span>
                  <span className={`shrink-0 font-semibold uppercase ${getLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                    {log.message}
                  </span>
                  {log.context && Object.keys(log.context).length > 0 && (
                    <span className="shrink-0 text-gray-400">
                      {expanded.has(index) ? "▼" : "▶"}
                    </span>
                  )}
                </div>
                {expanded.has(index) && log.context && (
                  <pre className="mt-2 overflow-x-auto rounded bg-gray-100 dark:bg-gray-900 p-2 text-xs">
                    {JSON.stringify(log.context, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-[var(--muted)]">
        {t("logs.hint", { default: "最近 1000 条日志缓存于内存，重启后清空" })}
      </p>
    </section>
  );
}
