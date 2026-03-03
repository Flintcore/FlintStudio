"use client";

import { useState } from "react";

type RunStatus = {
  id: string;
  status: string;
  currentPhase: string | null;
  errorMessage: string | null;
  steps: Array<{
    stepKey: string;
    stepTitle: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
  }>;
  finishedAt: string | null;
};

export function WorkflowRunForm({ projectId }: { projectId: string }) {
  const [novelText, setNovelText] = useState("");
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState("");

  async function startWorkflow() {
    const text = novelText.trim();
    if (!text) {
      setError("请粘贴小说或剧本文本");
      return;
    }
    setError("");
    setLoading(true);
    setRunId(null);
    setRunStatus(null);
    try {
      const res = await fetch("/api/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, novelText: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "启动失败");
        return;
      }
      setRunId(data.runId);
      const initial = await fetch(`/api/workflows/runs/${data.runId}`).then((r) => r.json());
      if (initial.id) setRunStatus(initial);
      pollRun(data.runId);
    } catch (e) {
      setError((e as Error).message ?? "请求失败");
    } finally {
      setLoading(false);
    }
  }

  function pollRun(id: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/workflows/runs/${id}`);
        const run: RunStatus = await res.json();
        if (!res.ok) return;
        setRunStatus(run);
        if (run.status === "completed" || run.status === "failed") {
          clearInterval(interval);
          return;
        }
      } catch {
        // ignore
      }
    }, 2000);
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900/50 p-6">
      <h2 className="mb-3 font-semibold">一键生成（多 Agent 自动流水线）</h2>
      <p className="mb-4 text-sm text-zinc-500">
        粘贴小说或剧本文本，自动执行：剧本分析 → 分场 → 分镜 → …（类似 Dify/n8n 的自动工作流）
      </p>
      <textarea
        value={novelText}
        onChange={(e) => setNovelText(e.target.value)}
        placeholder="在此粘贴小说或剧本文本…"
        className="mb-4 h-40 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
        disabled={loading}
      />
      {error && (
        <p className="mb-2 text-sm text-red-400">{error}</p>
      )}
      <button
        type="button"
        onClick={startWorkflow}
        disabled={loading}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? "启动中…" : "启动工作流"}
      </button>

      {runStatus && (
        <div className="mt-6 border-t border-zinc-700 pt-4">
          <h3 className="mb-2 font-medium">运行状态</h3>
          <p className="text-sm text-zinc-400">
            状态: <span className="text-white">{runStatus.status}</span>
            {runStatus.currentPhase && (
              <> · 当前阶段: {runStatus.currentPhase}</>
            )}
          </p>
          {runStatus.errorMessage && (
            <p className="mt-1 text-sm text-red-400">{runStatus.errorMessage}</p>
          )}
          <ul className="mt-3 space-y-1 text-sm">
            {runStatus.steps.map((s) => (
              <li key={s.stepKey} className="flex items-center gap-2">
                <span
                  className={
                    s.status === "completed"
                      ? "text-emerald-400"
                      : s.status === "running"
                        ? "text-amber-400"
                        : "text-zinc-500"
                  }
                >
                  {s.status === "completed" ? "✓" : s.status === "running" ? "…" : "○"}{" "}
                </span>
                {s.stepTitle} ({s.status})
              </li>
            ))}
          </ul>
          {(runStatus.status === "completed" || runStatus.status === "failed") && (
            <p className="mt-2 text-xs text-zinc-500">
              {runStatus.status === "completed"
                ? "运行已结束。请刷新页面查看最新集数、分场、分镜与出图。"
                : "运行失败，请检查设置中的 API 配置或重试。"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
