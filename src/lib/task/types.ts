export const TASK_TYPE = {
  ANALYZE_NOVEL: "analyze-novel",
  STORY_TO_SCRIPT: "story-to-script",
  SCRIPT_TO_STORYBOARD: "script-to-storyboard",
  IMAGE_CHARACTER: "image-character",
  IMAGE_LOCATION: "image-location",
  IMAGE_PANEL: "image-panel",
  VOICE_LINE: "voice-line",
  VIDEO_PANEL: "video-panel",
} as const;

export type TaskType = (typeof TASK_TYPE)[keyof typeof TASK_TYPE];

export type QueueType = "image" | "video" | "voice" | "text";

export interface TaskJobData {
  taskId: string;
  type: TaskType;
  userId: string;
  projectId: string;
  episodeId?: string;
  runId?: string;
  targetType: string;
  targetId: string;
  payload?: Record<string, unknown>;
}
