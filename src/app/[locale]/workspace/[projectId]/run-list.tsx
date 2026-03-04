"use client";

import { useState, useEffect } from "react";

type RunItem = {
  id: string;
  status: string;
  currentPhase: string | null;
  errorMessage: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  stepsCount: number;
};

export function RunList({ projectId }: { projectId: string }) {
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [queuedSince, setQueuedSince] = useState("");
  const [queuedUntil, setQueuedUntil] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ projectId, limit: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (queuedSince.trim()) params.set("queuedSince", new Date(queuedSince).toISOString());
    if (queuedUntil.trim()) params.set("queuedUntil", new Date(queuedUntil).toISOString());
    setLoading(true);
    fetch(`/api/workflows/runs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.runs) setRuns(data.runs);
      })
      .finally(() => setLoading(false));
  }, [projectId, statusFilter, queuedSince, queuedUntil]);

  return (
    <section className="mt-8 animate-slide-up animation-delay-100">
      <h2 className="font-medium text-[var(--foreground)]">运行记录</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3">
        <label className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
          状态
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[var(--foreground)]"
          >
            <option value="">全部</option>
            <option value="queued">排队</option>
            <option value="running">运行中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="canceled">已取消</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
          排队时间 起
          <input
            type="datetime-local"
            value={queuedSince}
            onChange={(e) => setQueuedSince(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[var(--foreground)]"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
          止
          <input
            type="datetime-local"
            value={queuedUntil}
            onChange={(e) => setQueuedUntil(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-[var(--foreground)]"
          />
        </label>
      </div>
      <ul className="card-base mt-3 space-y-2 rounded-2xl border border-[var(--border)] p-4">
        {loading ? (
          <li className="text-sm text-[var(--muted)]">加载中…</li>
        ) : runs.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">暂无运行记录</li>
        ) : (
          runs.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[var(--foreground)]">
                {r.status === "running" && (r.currentPhase ? `进行中 · ${r.currentPhase}` : "进行中")}
                {r.status === "completed" && "已完成"}
                {r.status === "failed" && (r.errorMessage || "失败")}
                {r.status === "queued" && "排队中"}
                {r.status === "canceled" && "已取消"}
              </span>
              <span className="text-[var(--muted-light)]">
                {new Date(r.queuedAt).toLocaleString("zh-CN")} · {r.stepsCount} 步
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
