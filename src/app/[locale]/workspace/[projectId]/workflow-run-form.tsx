"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { PipelineDagView } from "./workflow-pipeline-dag";

type RunStatus = {
  id: string;
  status: string;
  currentPhase: string | null;
  errorMessage: string | null;
  output?: { message?: string; issues?: string[] } | null;
  steps: Array<{
    stepKey: string;
    stepTitle: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    result?: Record<string, unknown> | null;
    payload?: { agent?: string; inputSummary?: Record<string, unknown> } | null;
  }>;
  finishedAt: string | null;
};

function stepResultSummary(step: RunStatus["steps"][0]): string | null {
  const r = step?.result;
  if (!r || typeof r !== "object") return null;
  if (step.stepKey === "analyze_novel" && r.episodeIds && Array.isArray(r.episodeIds)) {
    const review = r.review as { ok?: boolean; issues?: string[] } | undefined;
    const reviewText = review?.ok === true
      ? "复查: 通过"
      : review?.issues?.length
        ? `复查: ${review.issues.join("; ")}`
        : "复查: —";
    return `集数: ${(r.episodeIds as string[]).length} · ${reviewText}`;
  }
  if (r.clipIds && Array.isArray(r.clipIds))
    return `分场: ${(r.clipIds as string[]).length} 条`;
  return null;
}

export function WorkflowRunForm({ projectId }: { projectId: string }) {
  const [novelText, setNovelText] = useState("");
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState("");
  const [continueLoading, setContinueLoading] = useState(false);
  const [retryAnalyzeLoading, setRetryAnalyzeLoading] = useState(false);

  async function continueAfterReview() {
    if (!runId) return;
    setContinueLoading(true);
    try {
      const res = await fetch(`/api/workflows/runs/${runId}/continue`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "继续执行失败");
        return;
      }
      const updated = await fetch(`/api/workflows/runs/${runId}`).then((r) => r.json());
      if (updated.id) setRunStatus(updated);
      setError("");
      pollRun(runId);
    } catch (e) {
      setError((e as Error).message ?? "请求失败");
    } finally {
      setContinueLoading(false);
    }
  }

  async function retryAnalyze() {
    if (!runId) return;
    setRetryAnalyzeLoading(true);
    try {
      const res = await fetch(`/api/workflows/runs/${runId}/retry-analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "重试失败");
        return;
      }
      const updated = await fetch(`/api/workflows/runs/${runId}`).then((r) => r.json());
      if (updated.id) setRunStatus(updated);
      setError("");
      pollRun(runId);
    } catch (e) {
      setError((e as Error).message ?? "请求失败");
    } finally {
      setRetryAnalyzeLoading(false);
    }
  }

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
        if (run.currentPhase === "review_failed") {
          clearInterval(interval);
        }
      } catch {
        // ignore
      }
    }, 2000);
  }

  return (
    <section className="card-base glass-surface mt-8 p-6 animate-slide-up animation-delay-100">
      <h2 className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
          <Zap className="h-4 w-4" />
        </span>
        一键生成（多 Agent 自动流水线）
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        粘贴小说或剧本文本，自动执行：剧本分析 → 分场 → 分镜 → …
      </p>
      <textarea
        value={novelText}
        onChange={(e) => setNovelText(e.target.value)}
        placeholder="在此粘贴小说或剧本文本…"
        className="input-base mt-4 h-40 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)] disabled:opacity-50"
        disabled={loading}
      />
      {error && (
        <p className="mt-2 text-sm text-[var(--error)] animate-fade-in">{error}</p>
      )}
      <button
        type="button"
        onClick={startWorkflow}
        disabled={loading}
        className="mt-4 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-smooth hover-lift"
      >
        {loading ? "启动中…" : "启动工作流"}
      </button>

      {runStatus && (
        <div className="mt-6 border-t border-[var(--border)] pt-4 animate-fade-in">
          <h3 className="font-medium text-[var(--foreground)]">运行状态</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            状态: <span className="text-[var(--foreground)]">{runStatus.status}</span>
            {runStatus.currentPhase && (
              <> · 当前阶段: {runStatus.currentPhase}</>
            )}
          </p>
          {runStatus.errorMessage && (
            <p className="mt-1 text-sm text-[var(--error)]">{runStatus.errorMessage}</p>
          )}
          {runStatus.currentPhase === "review_failed" && (
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3 text-sm">
              <p className="text-[var(--foreground)]">
                {runStatus.output?.message ?? "复查未通过，请确认后继续执行或重跑。"}
              </p>
              {runStatus.output?.issues?.length ? (
                <ul className="mt-2 list-inside list-disc text-[var(--muted)]">
                  {runStatus.output.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                onClick={continueAfterReview}
                disabled={continueLoading}
                className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {continueLoading ? "继续中…" : "继续执行"}
              </button>
              <button
                type="button"
                onClick={retryAnalyze}
                disabled={retryAnalyzeLoading}
                className="mt-3 ml-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]/20 disabled:opacity-50"
              >
                {retryAnalyzeLoading ? "重试中…" : "重试剧本分析"}
              </button>
            </div>
          )}
          <PipelineDagView
            steps={runStatus.steps}
            currentPhase={runStatus.currentPhase}
            stepsDetail={runStatus.steps}
          />
          <ul className="mt-3 space-y-1.5 text-sm">
            {runStatus.steps.map((s) => {
              const summary = stepResultSummary(s);
              return (
                <li key={s.stepKey} className="flex items-center gap-2 flex-wrap">
                  <span
                    className={
                      s.status === "completed"
                        ? "text-[var(--success)]"
                        : s.status === "running"
                          ? "text-[var(--accent)] animate-pulse-slow"
                          : "text-[var(--muted)]"
                    }
                  >
                    {s.status === "completed" ? "✓" : s.status === "running" ? "…" : "○"}{" "}
                  </span>
                  <span>
                    {s.stepTitle} ({s.status})
                    {summary != null && (
                      <span className="ml-2 text-[var(--muted)]">· {summary}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {(runStatus.status === "completed" || runStatus.status === "failed") && (
            <p className="mt-3 text-xs text-[var(--muted)]">
              {runStatus.status === "completed"
                ? "运行已结束。请刷新页面查看最新集数、分场、分镜与出图。"
                : "运行失败，请检查设置中的 API 配置或重试。"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
