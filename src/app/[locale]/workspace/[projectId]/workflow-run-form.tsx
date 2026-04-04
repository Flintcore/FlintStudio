"use client";

import { useState, useRef } from "react";
import { Zap, Palette } from "lucide-react";
import { PipelineDagView } from "./workflow-pipeline-dag";
import { VISUAL_STYLES } from "@/lib/workflow/visual-style";

type RunStatus = {
  id: string;
  status: string;
  currentPhase: string | null;
  errorMessage: string | null;
  imageProgress?: { done: number; total: number } | null;
  output?: { message?: string; issues?: string[] } | null;
  steps: Array<{
    stepKey: string;
    stepTitle: string;
    status: string;
    errorMessage?: string | null;
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
    const review = r.review as { passed?: boolean; issues?: string[] } | undefined;
    const reviewText = review?.passed === true
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

export function WorkflowRunForm({
  projectId,
  defaultVisualStyle,
}: {
  projectId: string;
  defaultVisualStyle?: string | null;
}) {
  const [novelText, setNovelText] = useState("");
  const [visualStyle, setVisualStyle] = useState<string>(
    defaultVisualStyle && VISUAL_STYLES.some((s) => s.id === defaultVisualStyle)
      ? defaultVisualStyle
      : "default"
  );
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState("");
  const [continueLoading, setContinueLoading] = useState(false);
  const [retryAnalyzeLoading, setRetryAnalyzeLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

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

  async function cancelWorkflow() {
    if (!runId) return;
    setCancelLoading(true);
    stopPolling();
    try {
      const res = await fetch(`/api/workflows/runs/${runId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "取消失败");
        return;
      }
      setRunStatus((prev) => prev ? { ...prev, status: "canceled" } : prev);
      setError("");
    } catch (e) {
      setError((e as Error).message ?? "请求失败");
    } finally {
      setCancelLoading(false);
    }
  }

  async function doStartWorkflow() {
    const text = novelText.trim();
    if (!text) {
      setError("请粘贴小说或剧本文本");
      return;
    }
    setError("");
    setShowConfirm(false);
    setLoading(true);
    setRunId(null);
    setRunStatus(null);
    stopPolling();
    try {
      const res = await fetch("/api/workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          novelText: text,
          visualStyle: visualStyle === "default" ? undefined : visualStyle,
        }),
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

  async function startWorkflow() {
    // 如果已有运行中/已完成的记录，弹出确认框
    if (runStatus && (runStatus.status === "running" || runStatus.status === "completed")) {
      setShowConfirm(true);
      return;
    }
    await doStartWorkflow();
  }

  function pollRun(id: string) {
    stopPolling();
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/workflows/runs/${id}`);
        const run: RunStatus = await res.json();
        if (!res.ok) return;
        setRunStatus(run);
        if (
          run.status === "completed" ||
          run.status === "failed" ||
          run.status === "canceled"
        ) {
          stopPolling();
          return;
        }
        if (run.currentPhase === "review_failed") {
          stopPolling();
        }
      } catch {
        // ignore
      }
    }, 2000);
  }

  // 找到 voice 失败步骤
  const voiceFailedStep = runStatus?.steps.find(
    (s) => s.stepKey === "voice" && s.status === "failed"
  );

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

      <div className="mt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <Palette className="h-4 w-4 text-[var(--accent)]" />
          画风（视觉风格）
        </label>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          选择后，分镜与出图将统一采用该风格
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {VISUAL_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setVisualStyle(s.id)}
              disabled={loading}
              className={`relative rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] disabled:opacity-50 ${
                visualStyle === s.id
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent-muted)]"
                  : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)]/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className={`text-sm font-medium ${visualStyle === s.id ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>
                  {s.labelZh}
                </span>
                {visualStyle === s.id && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-white text-xs">
                    ✓
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">
                {s.descriptionForLlm.slice(0, 30)}…
              </p>
            </button>
          ))}
        </div>
      </div>

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

      {/* 重跑确认弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card-base glass-surface w-full max-w-sm rounded-2xl border border-[var(--border)] p-6 shadow-xl animate-fade-in">
            <h3 className="font-semibold text-[var(--foreground)]">确认重新运行？</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              重新运行将覆盖当前所有已生成内容，包括图片、音频和视频。此操作不可撤销。
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/20"
              >
                取消
              </button>
              <button
                type="button"
                onClick={doStartWorkflow}
                className="rounded-lg bg-[var(--error)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                确认重新运行
              </button>
            </div>
          </div>
        </div>
      )}

      {runStatus && (
        <div className="mt-6 border-t border-[var(--border)] pt-4 animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-medium text-[var(--foreground)]">运行状态</h3>
            {(runStatus.status === "running" || runStatus.status === "queued") && (
              <button
                type="button"
                onClick={cancelWorkflow}
                disabled={cancelLoading}
                className="rounded-lg border border-[var(--error)]/40 bg-[var(--error)]/5 px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error)]/10 disabled:opacity-50"
              >
                {cancelLoading ? "取消中…" : "取消运行"}
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            状态: <span className="text-[var(--foreground)]">{runStatus.status}</span>
            {runStatus.currentPhase && (
              <> · 当前阶段: {runStatus.currentPhase}</>
            )}
          </p>
          {runStatus.errorMessage && (
            <p className="mt-1 text-sm text-[var(--error)]">{runStatus.errorMessage}</p>
          )}

          {/* P0③: TTS 失败详细信息 */}
          {voiceFailedStep && (
            <div className="mt-2 rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/5 p-3 text-sm">
              <p className="font-medium text-[var(--error)]">配音阶段失败</p>
              {voiceFailedStep.errorMessage && (
                <p className="mt-1 text-[var(--muted)]">{voiceFailedStep.errorMessage}</p>
              )}
              <p className="mt-1 text-xs text-[var(--muted)]">请检查设置中的 TTS API 配置是否正确。</p>
            </div>
          )}

          {/* P1④: 图像生成进度条 */}
          {runStatus.currentPhase === "image_panels" && runStatus.imageProgress && runStatus.imageProgress.total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
                <span>图像生成中</span>
                <span>{runStatus.imageProgress.done} / {runStatus.imageProgress.total} 张</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                  style={{ width: `${Math.round((runStatus.imageProgress.done / runStatus.imageProgress.total) * 100)}%` }}
                />
              </div>
            </div>
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
                          : s.status === "failed"
                            ? "text-[var(--error)]"
                            : "text-[var(--muted)]"
                    }
                  >
                    {s.status === "completed" ? "✓" : s.status === "running" ? "…" : s.status === "failed" ? "✗" : "○"}{" "}
                  </span>
                  <span>
                    {s.stepTitle} ({s.status})
                    {summary != null && (
                      <span className="ml-2 text-[var(--muted)]">· {summary}</span>
                    )}
                    {s.status === "failed" && s.errorMessage && (
                      <span className="ml-2 text-[var(--error)] text-xs">— {s.errorMessage}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {(runStatus.status === "completed" || runStatus.status === "failed" || runStatus.status === "canceled") && (
            <p className="mt-3 text-xs text-[var(--muted)]">
              {runStatus.status === "completed"
                ? "运行已结束。请刷新页面查看最新集数、分场、分镜与出图。"
                : runStatus.status === "canceled"
                  ? "运行已取消。"
                  : "运行失败，请检查设置中的 API 配置或重试。"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
