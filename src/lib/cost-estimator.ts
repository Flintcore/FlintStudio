/**
 * 工作流成本预估器
 * 根据小说长度和配置预估 API 调用成本
 */

interface CostEstimate {
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  images: {
    count: number;
    breakdown: {
      characters: number;
      locations: number;
      panels: number;
    };
  };
  voice: {
    durationSeconds: number;
    characters: number;
  };
  video: {
    count: number;
    durationSeconds: number;
  };
  estimatedCostUSD: {
    llm: number;
    image: number;
    voice: number;
    video: number;
    total: number;
  };
  estimatedTimeMinutes: {
    min: number;
    max: number;
  };
}

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

// 主流模型定价（USD per 1M tokens，截至 2026 年）
const LLM_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "claude-3-5-sonnet": { inputPer1M: 3, outputPer1M: 15 },
  "claude-haiku": { inputPer1M: 0.8, outputPer1M: 4 },
  "deepseek-chat": { inputPer1M: 0.14, outputPer1M: 0.28 },
  "qwen-max": { inputPer1M: 2, outputPer1M: 6 },
  "moonshot-v1": { inputPer1M: 1.5, outputPer1M: 4.5 },
  "glm-4": { inputPer1M: 0.7, outputPer1M: 2 },
  default: { inputPer1M: 1, outputPer1M: 3 },
};

// 图像生成定价（USD per image）
const IMAGE_PRICING: Record<string, number> = {
  "dall-e-3": 0.04,
  "midjourney": 0.03,
  "stable-diffusion": 0.005,
  "flux-schnell": 0.003,
  "flux-pro": 0.05,
  "default": 0.02,
};

// TTS 定价（USD per 1M characters）
const TTS_PRICING_PER_1M = 15;

// 视频生成定价（USD per second）
const VIDEO_PRICING_PER_SECOND = 0.5; // Seedance 2.0 大约价格

// 配置参数
const CONFIG = {
  // 每集字符数
  CHARS_PER_EPISODE: 2000,
  // 每集分场数
  CLIPS_PER_EPISODE: 5,
  // 每个分场分镜数
  PANELS_PER_CLIP: 9,
  // 平均角色数
  AVG_CHARACTERS: 5,
  // 平均场景数
  AVG_LOCATIONS: 3,
  // 配音字符数与原文比例
  VOICE_RATIO: 0.6,
  // 视频时长（秒/分镜）
  VIDEO_DURATION_PER_PANEL: 5,
  // 中文字符到 token 的转换比例（粗略估算）
  CHARS_TO_TOKENS: 1.5,
};

/**
 * 预估工作流成本
 */
export function estimateWorkflowCost(opts: {
  novelLength: number;
  llmModel?: string;
  imageModel?: string;
  videoModel?: string;
}): CostEstimate {
  const { novelLength, llmModel = "default", imageModel = "default" } = opts;

  // 估算集数
  const episodes = Math.max(1, Math.ceil(novelLength / CONFIG.CHARS_PER_EPISODE));

  // 估算分场数和分镜数
  const totalClips = episodes * CONFIG.CLIPS_PER_EPISODE;
  const totalPanels = totalClips * CONFIG.PANELS_PER_CLIP;

  // 估算 tokens
  // 输入：原文 + 角色信息 + 场景信息 + 上下文（每次调用都需要）
  // 输出：分析结果 + 分场 + 分镜 + 配音文本
  const baseInputTokens = novelLength * CONFIG.CHARS_TO_TOKENS;
  const inputTokens = Math.ceil(
    baseInputTokens * 4 + // 4 个阶段都要传入原文
      episodes * 1000 * CONFIG.CHARS_TO_TOKENS // 角色场景信息
  );
  const outputTokens = Math.ceil(
    novelLength * 0.5 * CONFIG.CHARS_TO_TOKENS + // 分析输出
      totalClips * 200 * CONFIG.CHARS_TO_TOKENS + // 分场摘要
      totalPanels * 100 * CONFIG.CHARS_TO_TOKENS + // 分镜描述
      novelLength * CONFIG.VOICE_RATIO * CONFIG.CHARS_TO_TOKENS // 配音文本
  );

  // 估算图像数
  const characterImages = CONFIG.AVG_CHARACTERS * 3; // 每个角色 3 个表情
  const locationImages = CONFIG.AVG_LOCATIONS * 2; // 每个场景 2 张图
  const panelImages = totalPanels;
  const totalImages = characterImages + locationImages + panelImages;

  // 估算配音
  const voiceCharacters = Math.ceil(novelLength * CONFIG.VOICE_RATIO);
  const voiceDurationSeconds = Math.ceil(voiceCharacters / 5); // 中文约 5 字/秒

  // 估算视频
  const videoCount = totalPanels;
  const videoDurationSeconds = videoCount * CONFIG.VIDEO_DURATION_PER_PANEL;

  // 计算价格
  const llmPricing = LLM_PRICING[llmModel] || LLM_PRICING.default;
  const llmCost =
    (inputTokens / 1_000_000) * llmPricing.inputPer1M +
    (outputTokens / 1_000_000) * llmPricing.outputPer1M;

  const imagePricing = IMAGE_PRICING[imageModel] || IMAGE_PRICING.default;
  const imageCost = totalImages * imagePricing;

  const voiceCost = (voiceCharacters / 1_000_000) * TTS_PRICING_PER_1M;

  const videoCost = videoDurationSeconds * VIDEO_PRICING_PER_SECOND;

  const totalCost = llmCost + imageCost + voiceCost + videoCost;

  // 估算时间（视频生成最耗时）
  const minMinutes = Math.ceil(totalPanels * 0.5 + episodes * 3);
  const maxMinutes = Math.ceil(totalPanels * 2 + episodes * 10);

  return {
    tokens: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    },
    images: {
      count: totalImages,
      breakdown: {
        characters: characterImages,
        locations: locationImages,
        panels: panelImages,
      },
    },
    voice: {
      durationSeconds: voiceDurationSeconds,
      characters: voiceCharacters,
    },
    video: {
      count: videoCount,
      durationSeconds: videoDurationSeconds,
    },
    estimatedCostUSD: {
      llm: Number(llmCost.toFixed(4)),
      image: Number(imageCost.toFixed(4)),
      voice: Number(voiceCost.toFixed(4)),
      video: Number(videoCost.toFixed(4)),
      total: Number(totalCost.toFixed(4)),
    },
    estimatedTimeMinutes: {
      min: minMinutes,
      max: maxMinutes,
    },
  };
}

/**
 * 转换 USD 到 CNY（粗略汇率）
 */
export function toCNY(usd: number): number {
  return Number((usd * 7.2).toFixed(2));
}

/**
 * 格式化成本预估为可读文本
 */
export function formatEstimate(estimate: CostEstimate, language: "zh" | "en" = "zh"): string {
  const lines: string[] = [];

  if (language === "zh") {
    lines.push("📊 工作流成本预估");
    lines.push("");
    lines.push(`💰 预计总成本: $${estimate.estimatedCostUSD.total} (约 ¥${toCNY(estimate.estimatedCostUSD.total)})`);
    lines.push(`⏱  预计耗时: ${estimate.estimatedTimeMinutes.min} - ${estimate.estimatedTimeMinutes.max} 分钟`);
    lines.push("");
    lines.push("详细分解:");
    lines.push(`  📝 LLM Tokens: ${estimate.tokens.total.toLocaleString()} ($${estimate.estimatedCostUSD.llm})`);
    lines.push(`  🎨 图像生成: ${estimate.images.count} 张 ($${estimate.estimatedCostUSD.image})`);
    lines.push(`  🎤 语音合成: ${estimate.voice.durationSeconds}s ($${estimate.estimatedCostUSD.voice})`);
    lines.push(`  🎬 视频生成: ${estimate.video.count} 个 / ${estimate.video.durationSeconds}s ($${estimate.estimatedCostUSD.video})`);
  } else {
    lines.push("📊 Workflow Cost Estimate");
    lines.push("");
    lines.push(`💰 Total Cost: $${estimate.estimatedCostUSD.total}`);
    lines.push(`⏱  Time: ${estimate.estimatedTimeMinutes.min} - ${estimate.estimatedTimeMinutes.max} min`);
    lines.push("");
    lines.push("Breakdown:");
    lines.push(`  📝 LLM Tokens: ${estimate.tokens.total.toLocaleString()} ($${estimate.estimatedCostUSD.llm})`);
    lines.push(`  🎨 Images: ${estimate.images.count} ($${estimate.estimatedCostUSD.image})`);
    lines.push(`  🎤 Voice: ${estimate.voice.durationSeconds}s ($${estimate.estimatedCostUSD.voice})`);
    lines.push(`  🎬 Video: ${estimate.video.count} / ${estimate.video.durationSeconds}s ($${estimate.estimatedCostUSD.video})`);
  }

  return lines.join("\n");
}
