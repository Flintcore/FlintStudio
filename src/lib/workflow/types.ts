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

/** 阶段顺序：novel-to-video 的 DAG 阶段 */
export const PHASES = [
  "analyze_novel",     // 1. 剧本分析 → 角色、场景、集数
  "story_to_script",  // 2. 每集：小说 → 分场/镜头
  "script_to_storyboard", // 3. 每场：生成分镜
  "image_panels",     // 4. 每镜头：出图
  "voice",            // 5. 配音
  "video",            // 6. 合成成片
] as const;

export type Phase = (typeof PHASES)[number];
