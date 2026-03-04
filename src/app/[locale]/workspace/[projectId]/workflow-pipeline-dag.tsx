"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/** 流水线阶段（DAG 节点，不含 review_failed） */
export const PIPELINE_PHASES = [
  { key: "analyze_novel", label: "剧本分析" },
  { key: "story_to_script", label: "分场" },
  { key: "script_to_storyboard", label: "分镜" },
  { key: "image_panels", label: "出图" },
  { key: "voice", label: "配音" },
  { key: "video", label: "视频合成" },
] as const;

export type StepDetail = {
  stepKey: string;
  stepTitle: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  result?: Record<string, unknown> | null;
  payload?: { agent?: string; inputSummary?: Record<string, unknown> } | null;
};

function phaseStatus(
  phaseKey: string,
  steps: { stepKey: string; status: string }[]
): "pending" | "running" | "completed" | "failed" {
  const phaseSteps = steps.filter(
    (s) => s.stepKey === phaseKey || s.stepKey.startsWith(phaseKey + "_")
  );
  if (phaseSteps.length === 0) return "pending";
  if (phaseSteps.some((s) => s.status === "running")) return "running";
  if (phaseSteps.some((s) => s.status === "failed")) return "failed";
  if (phaseSteps.every((s) => s.status === "completed")) return "completed";
  return "pending";
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 56;
const GAP = 80;

type PhaseNodeData = {
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  phaseKey: string;
};

function PhaseNode({ data, selected }: NodeProps<Node<PhaseNodeData>>) {
  const status = data.status;
  const isRunning = status === "running";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";

  return (
    <div
      className={`
        flex flex-col items-center justify-center rounded-xl border-2 px-4 py-2.5 shadow-sm transition-all cursor-pointer
        ${selected ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--background)]" : ""}
        ${isCompleted ? "border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]" : ""}
        ${isRunning ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : ""}
        ${isFailed ? "border-[var(--error)] bg-[var(--error)]/10 text-[var(--error)]" : ""}
        ${status === "pending" ? "border-[var(--border)] bg-[var(--muted)]/5 text-[var(--muted)]" : ""}
        hover:brightness-95
      `}
      style={{ minWidth: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      <span className="text-sm font-medium">{data.label}</span>
      <span className="mt-0.5 text-xs opacity-90">
        {isCompleted ? "✓ 完成" : isRunning ? "… 运行中" : isFailed ? "✗ 失败" : "○ 待执行"}
      </span>
    </div>
  );
}

const nodeTypes = { phaseNode: PhaseNode };

function formatResultSummary(step: StepDetail): string | null {
  const r = step.result;
  if (!r || typeof r !== "object") return null;
  if (step.stepKey === "analyze_novel" && r.episodeIds && Array.isArray(r.episodeIds)) {
    const review = r.review as { ok?: boolean; issues?: string[] } | undefined;
    const reviewText =
      review?.ok === true
        ? "复查: 通过"
        : review?.issues?.length
          ? `复查: ${review.issues.join("; ")}`
          : "复查: —";
    return `集数: ${(r.episodeIds as string[]).length} · ${reviewText}`;
  }
  if (r.clipIds && Array.isArray(r.clipIds)) return `分场: ${(r.clipIds as string[]).length} 条`;
  if (r.panelIds && Array.isArray(r.panelIds)) return `分镜: ${(r.panelIds as string[]).length} 个镜头`;
  if (r.panelsProcessed != null) return `出图: ${r.panelsProcessed} 张`;
  if (r.lineIds && Array.isArray(r.lineIds)) return `配音: ${(r.lineIds as string[]).length} 条`;
  if (r.videoUrl) return "视频已生成";
  return null;
}

function formatDuration(started: string | null, finished: string | null): string | null {
  if (!started || !finished) return null;
  const a = new Date(started).getTime();
  const b = new Date(finished).getTime();
  const s = Math.round((b - a) / 1000);
  if (s < 60) return `${s} 秒`;
  return `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
}

export function PipelineDagView({
  steps,
  currentPhase,
  stepsDetail,
}: {
  steps: { stepKey: string; status: string }[];
  currentPhase: string | null;
  stepsDetail?: StepDetail[];
}) {
  const [selectedPhaseKey, setSelectedPhaseKey] = useState<string | null>(null);

  const nodes: Node<PhaseNodeData>[] = useMemo(
    () =>
      PIPELINE_PHASES.map((phase, i) => ({
        id: phase.key,
        type: "phaseNode" as const,
        position: { x: i * (NODE_WIDTH + GAP), y: 0 },
        data: {
          label: phase.label,
          status: phaseStatus(phase.key, steps),
          phaseKey: phase.key,
        },
        selectable: true,
      })),
    [steps]
  );

  const edges: Edge[] = useMemo(
    () =>
      PIPELINE_PHASES.slice(0, -1).map((_, i) => ({
        id: `e-${PIPELINE_PHASES[i].key}-${PIPELINE_PHASES[i + 1].key}`,
        source: PIPELINE_PHASES[i].key,
        target: PIPELINE_PHASES[i + 1].key,
        type: "smoothstep",
      })),
    []
  );

  const [nodesState, setNodes, onNodesChange] = useNodesState(nodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const phaseKey = node.data?.phaseKey;
      setSelectedPhaseKey(typeof phaseKey === "string" ? phaseKey : null);
    },
    []
  );

  const phaseSteps = useMemo(() => {
    if (!selectedPhaseKey || !stepsDetail?.length) return [];
    return stepsDetail.filter(
      (s) => s.stepKey === selectedPhaseKey || s.stepKey.startsWith(selectedPhaseKey + "_")
    );
  }, [selectedPhaseKey, stepsDetail]);

  const selectedLabel = selectedPhaseKey
    ? PIPELINE_PHASES.find((p) => p.key === selectedPhaseKey)?.label ?? selectedPhaseKey
    : null;

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 overflow-hidden">
      <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        流水线 DAG · 点击节点查看阶段详情（输入/输出/用时）
      </p>
      <div className="h-[200px] w-full">
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          proOptions={{ hideAttribution: true }}
          className="bg-transparent"
        >
          <Background gap={12} size={1} color="var(--border)" />
          <Controls showInteractive={false} className="!bottom-2 !top-auto" />
          <MiniMap
            nodeColor={(n) => {
              const s = (n.data as PhaseNodeData).status;
              if (s === "completed") return "var(--success)";
              if (s === "running") return "var(--accent)";
              if (s === "failed") return "var(--error)";
              return "var(--muted)";
            }}
            className="!bottom-2 !left-2 !bg-[var(--background)]/80"
          />
        </ReactFlow>
      </div>

      {selectedPhaseKey && selectedLabel && (
        <div className="border-t border-[var(--border)] bg-[var(--muted)]/5 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-[var(--foreground)]">
              阶段详情：{selectedLabel}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedPhaseKey(null)}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              关闭
            </button>
          </div>
          {phaseSteps.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted)]">该阶段暂无步骤记录</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {phaseSteps.map((s) => {
                const duration = formatDuration(s.startedAt, s.finishedAt);
                const resultSummary = formatResultSummary(s);
                return (
                  <li
                    key={s.stepKey}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={
                          s.status === "completed"
                            ? "text-[var(--success)]"
                            : s.status === "running"
                              ? "text-[var(--accent)]"
                              : s.status === "failed"
                                ? "text-[var(--error)]"
                                : "text-[var(--muted)]"
                        }
                      >
                        {s.status === "completed" ? "✓" : s.status === "running" ? "…" : s.status === "failed" ? "✗" : "○"}
                      </span>
                      <span className="font-medium text-[var(--foreground)]">{s.stepTitle}</span>
                      <span className="text-[var(--muted)]">({s.status})</span>
                      {duration && (
                        <span className="text-[var(--muted)]">· 用时 {duration}</span>
                      )}
                    </div>
                    {(s.payload?.agent || s.payload?.inputSummary) && (
                      <div className="mt-2 text-[var(--muted)]">
                        {s.payload.agent && (
                          <span className="mr-2">Agent: {s.payload.agent}</span>
                        )}
                        {s.payload.inputSummary &&
                          Object.keys(s.payload.inputSummary).length > 0 && (
                            <span>
                              输入摘要:{" "}
                              {JSON.stringify(s.payload.inputSummary)}
                            </span>
                          )}
                      </div>
                    )}
                    {resultSummary && (
                      <p className="mt-1 text-[var(--muted)]">输出: {resultSummary}</p>
                    )}
                    {s.result &&
                      typeof s.result === "object" &&
                      Object.keys(s.result).length > 0 &&
                      !resultSummary && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[var(--muted)]">
                            查看原始 result
                          </summary>
                          <pre className="mt-1 max-h-32 overflow-auto rounded bg-[var(--muted)]/10 p-2 text-[10px]">
                            {JSON.stringify(s.result, null, 2)}
                          </pre>
                        </details>
                      )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
