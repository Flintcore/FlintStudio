"use client";

/** 流水线阶段（用于可视化，不含 review_failed） */
const PIPELINE_PHASES = [
  { key: "analyze_novel", label: "剧本分析" },
  { key: "story_to_script", label: "分场" },
  { key: "script_to_storyboard", label: "分镜" },
  { key: "image_panels", label: "出图" },
  { key: "voice", label: "配音" },
  { key: "video", label: "视频合成" },
] as const;

type Step = {
  stepKey: string;
  status: string;
};

function phaseStatus(phaseKey: string, steps: Step[]): "pending" | "running" | "completed" | "failed" {
  const phaseSteps = steps.filter(
    (s) => s.stepKey === phaseKey || s.stepKey.startsWith(phaseKey + "_")
  );
  if (phaseSteps.length === 0) return "pending";
  if (phaseSteps.some((s) => s.status === "running")) return "running";
  if (phaseSteps.some((s) => s.status === "failed")) return "failed";
  if (phaseSteps.every((s) => s.status === "completed")) return "completed";
  return "pending";
}

export function PipelineView({
  steps,
  currentPhase,
}: {
  steps: Step[];
  currentPhase: string | null;
}) {
  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        流水线视图
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {PIPELINE_PHASES.map((phase, i) => {
          const status = phaseStatus(phase.key, steps);
          const isCurrent = currentPhase === phase.key;
          return (
            <div key={phase.key} className="flex items-center gap-2">
              <div
                className={`
                  flex min-w-[5rem] flex-col items-center rounded-lg border-2 px-3 py-2 text-center transition-smooth
                  ${status === "completed" ? "border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]" : ""}
                  ${status === "running" || isCurrent ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : ""}
                  ${status === "failed" ? "border-[var(--error)] bg-[var(--error)]/10 text-[var(--error)]" : ""}
                  ${status === "pending" ? "border-[var(--border)] bg-[var(--muted)]/5 text-[var(--muted)]" : ""}
                `}
              >
                <span className="text-xs font-medium">{phase.label}</span>
                <span className="mt-0.5 text-[10px] opacity-80">
                  {status === "completed" ? "✓" : status === "running" ? "…" : status === "failed" ? "✗" : "○"}
                </span>
              </div>
              {i < PIPELINE_PHASES.length - 1 && (
                <span className="text-[var(--muted)]" aria-hidden>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
