/** 工作流运行状态 */
export const RUN_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELED: "canceled",
} as const;

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];

export const STEP_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

/** 内置工作流 ID */
export const WORKFLOW_ID = {
  NOVEL_TO_VIDEO: "novel-to-video",
} as const;

/** 阶段顺序：novel-to-video 的 DAG 阶段（含 review_failed 暂停态） */
export const PHASES = [
  "analyze_novel",
  "review_failed",   // 复查未通过，等待用户「继续执行」
  "story_to_script",
  "script_to_storyboard",
  "image_panels",
  "voice",
  "video",
] as const;

export type Phase = (typeof PHASES)[number];

/** 步骤 key 与显式 Agent 名称（多 Agent 可观测） */
export const AGENT_BY_STEP_KEY: Record<string, string> = {
  analyze_novel: "剧本分析Agent",
  story_to_script: "分场Agent",
  script_to_storyboard: "分镜Agent",
  image_panels: "出图Agent",
  voice: "配音Agent",
  video: "视频合成Agent",
};

export function getAgentNameForStepKey(stepKey: string): string {
  for (const [prefix, name] of Object.entries(AGENT_BY_STEP_KEY)) {
    if (stepKey === prefix || stepKey.startsWith(prefix + "_")) return name;
  }
  return "Agent";
}
