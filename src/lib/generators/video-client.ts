/**
 * Seedance 2.0 API 客户端
 * 用于视频生成，支持图像到视频、文本到视频
 */

import { getUserApiConfig } from "@/lib/api-config";
import { withRetry, HTTP_RETRY_OPTIONS } from "@/lib/utils/retry";
import { logger } from "@/lib/logger";

interface SeedanceConfig {
  baseUrl: string;
  apiKey: string;
  model?: string;
}

interface VideoGenerationRequest {
  prompt?: string;
  imageUrl?: string;
  duration?: number; // 秒数，通常 5-10 秒
  aspectRatio?: "16:9" | "9:16" | "1:1";
  motionStrength?: number; // 0-10，运动强度
}

interface VideoGenerationResponse {
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}

/** 获取 Seedance API 配置 */
async function getSeedanceConfig(userId: string): Promise<SeedanceConfig> {
  const config = await getUserApiConfig(userId, "video");

  if (!config?.baseUrl) {
    throw new Error("请先在设置中配置视频生成 Base URL 和 API Key");
  }

  if (!config.apiKey) {
    throw new Error("请先在设置中配置视频生成 API Key");
  }

  return {
    baseUrl: config.baseUrl.replace(/\/$/, ""), // 移除末尾斜杠
    apiKey: config.apiKey,
    model: config.model || "seedance-v2",
  };
}

/** 提交视频生成任务 */
async function submitVideoGeneration(
  config: SeedanceConfig,
  request: VideoGenerationRequest
): Promise<{ taskId: string }> {
  const response = await fetch(`${config.baseUrl}/v1/videos/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      prompt: request.prompt,
      image_url: request.imageUrl,
      duration: request.duration || 5,
      aspect_ratio: request.aspectRatio || "16:9",
      motion_strength: request.motionStrength || 5,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`视频生成提交失败: ${response.status} ${error}`);
  }

  const data = await response.json();
  return { taskId: data.task_id || data.id };
}

/** 查询视频生成状态 */
async function pollVideoStatus(
  config: SeedanceConfig,
  taskId: string
): Promise<VideoGenerationResponse> {
  const response = await fetch(
    `${config.baseUrl}/v1/videos/generations/${taskId}`,
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`查询视频状态失败: ${response.status}`);
  }

  const data = await response.json();
  return {
    taskId,
    status: data.status,
    videoUrl: data.video_url,
    error: data.error,
  };
}

/** 等待视频生成完成 */
async function waitForVideoCompletion(
  config: SeedanceConfig,
  taskId: string,
  options: { timeout?: number; interval?: number } = {}
): Promise<string> {
  const { timeout = 300000, interval = 5000 } = options; // 默认 5 分钟超时，5 秒轮询
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await pollVideoStatus(config, taskId);

    logger.debug(
      {
        type: "video_poll",
        taskId,
        status: status.status,
      },
      `视频生成状态: ${status.status}`
    );

    if (status.status === "completed" && status.videoUrl) {
      return status.videoUrl;
    }

    if (status.status === "failed") {
      throw new Error(status.error || "视频生成失败");
    }

    // 继续等待
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error("视频生成超时");
}

/** 生成视频（完整流程：提交 + 轮询） */
export async function generateVideo(opts: {
  userId: string;
  prompt?: string;
  imageUrl?: string;
  duration?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  motionStrength?: number;
}): Promise<{ videoUrl: string; taskId: string }> {
  const config = await getSeedanceConfig(opts.userId);

  logger.info(
    {
      type: "video_generation_start",
      userId: opts.userId,
      hasPrompt: !!opts.prompt,
      hasImage: !!opts.imageUrl,
    },
    "开始视频生成"
  );

  return withRetry(
    async () => {
      // 1. 提交任务
      const { taskId } = await submitVideoGeneration(config, {
        prompt: opts.prompt,
        imageUrl: opts.imageUrl,
        duration: opts.duration,
        aspectRatio: opts.aspectRatio,
        motionStrength: opts.motionStrength,
      });

      logger.info(
        {
          type: "video_task_submitted",
          taskId,
        },
        "视频生成任务已提交"
      );

      // 2. 轮询等待完成
      const videoUrl = await waitForVideoCompletion(config, taskId, {
        timeout: 600000, // 10 分钟超时（视频生成较慢）
        interval: 10000, // 10 秒轮询
      });

      logger.info(
        {
          type: "video_generation_complete",
          taskId,
          videoUrl,
        },
        "视频生成完成"
      );

      return { videoUrl, taskId };
    },
    {
      ...HTTP_RETRY_OPTIONS,
      maxAttempts: 2, // 整体流程重试次数较少，避免重复提交
      onRetry: (error, attempt) => {
        logger.warn(
          {
            type: "video_retry",
            attempt,
            error: error.message,
          },
          `视频生成失败，第 ${attempt} 次重试`
        );
      },
    }
  );
}

/** 仅提交视频生成任务（异步模式） */
export async function submitVideoGenerationAsync(opts: {
  userId: string;
  prompt?: string;
  imageUrl?: string;
  duration?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  motionStrength?: number;
}): Promise<{ taskId: string }> {
  const config = await getSeedanceConfig(opts.userId);

  const { taskId } = await submitVideoGeneration(config, {
    prompt: opts.prompt,
    imageUrl: opts.imageUrl,
    duration: opts.duration,
    aspectRatio: opts.aspectRatio,
    motionStrength: opts.motionStrength,
  });

  logger.info(
    {
      type: "video_async_submitted",
      taskId,
    },
    "视频生成任务已提交（异步）"
  );

  return { taskId };
}

/** 查询视频生成结果（异步模式） */
export async function getVideoGenerationResult(
  userId: string,
  taskId: string
): Promise<VideoGenerationResponse> {
  const config = await getSeedanceConfig(userId);
  return pollVideoStatus(config, taskId);
}
