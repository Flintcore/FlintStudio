import { llmJson } from "@/lib/llm/client";

const REVIEW_SYSTEM = `你是资深剧本分析质检专家。请按以下维度评估分析结果质量：

1. 集数完整性（25分）：是否有至少1集，每集是否有实质内容（非空、非占位符）
2. 角色一致性（25分）：角色是否与剧情相关，描述是否合理（非无意义占位）
3. 场景合理性（25分）：场景是否与剧情相关，是否符合故事背景
4. 内容连贯性（25分）：集与集之间是否连贯，是否有明显逻辑错误

评分标准：
- 优秀(90-100分)：无需修改直接通过
- 合格(70-89分)：有小问题需标注但可通过
- 不合格(<70分)：需返回修改，列出具体问题

输出格式（严格 JSON）：
{
  "score": number,
  "passed": boolean,
  "dimensions": {
    "episodes": {"score": number, "comment": string},
    "characters": {"score": number, "comment": string},
    "locations": {"score": number, "comment": string},
    "coherence": {"score": number, "comment": string}
  },
  "issues": string[]
}

注意：
- 如果 episodes 为空数组，score 必须为 0，passed 为 false
- 如果 characters 或 locations 全是无意义占位符（如"待定"、"未知"、"N/A"），相应维度扣分
- 任何维度 score < 15 时，整体 passed 应为 false`;

export interface ReviewResult {
  score: number;
  passed: boolean;
  dimensions: {
    episodes: { score: number; comment: string };
    characters: { score: number; comment: string };
    locations: { score: number; comment: string };
    coherence: { score: number; comment: string };
  };
  issues: string[];
}

/**
 * 运行剧本分析复查
 * @returns 复查结果，包含评分和是否通过
 */
export async function runReviewAnalysis(opts: {
  userId: string;
  episodeCount: number;
  characterCount: number;
  locationCount: number;
}): Promise<ReviewResult> {
  const { userId, episodeCount, characterCount, locationCount } = opts;

  try {
    const json = await llmJson<{
      score?: number;
      passed?: boolean;
      dimensions?: ReviewResult["dimensions"];
      issues?: string[];
    }>(
      userId,
      REVIEW_SYSTEM,
      `当前剧本分析结果：共 ${episodeCount} 集、${characterCount} 个角色、${locationCount} 个场景。请复查并返回评分。`,
      { temperature: 0.1 }
    );

    // 规范化结果
    const score = typeof json?.score === "number" ? Math.max(0, Math.min(100, json.score)) : 0;
    const passed = json?.passed === true && score >= 70;
    const issues = Array.isArray(json?.issues) ? json.issues : [];

    // 如果没有 dimensions，创建默认值
    const defaultDimension = { score: 0, comment: "未评估" };
    const dimensions = json?.dimensions || {
      episodes: defaultDimension,
      characters: defaultDimension,
      locations: defaultDimension,
      coherence: defaultDimension,
    };

    // 确保每个维度都有值
    dimensions.episodes = dimensions.episodes || defaultDimension;
    dimensions.characters = dimensions.characters || defaultDimension;
    dimensions.locations = dimensions.locations || defaultDimension;
    dimensions.coherence = dimensions.coherence || defaultDimension;

    return { score, passed, dimensions, issues };
  } catch (error) {
    // 复查失败时，返回未通过状态，要求人工检查
    console.error("[ReviewAnalysis] 复查 Agent 调用失败:", error);
    return {
      score: 0,
      passed: false,
      dimensions: {
        episodes: { score: 0, comment: "复查失败，无法评估" },
        characters: { score: 0, comment: "复查失败，无法评估" },
        locations: { score: 0, comment: "复查失败，无法评估" },
        coherence: { score: 0, comment: "复查失败，无法评估" },
      },
      issues: [
        `复查 Agent 调用失败: ${error instanceof Error ? error.message : String(error)}`,
        "建议人工检查剧本分析结果",
      ],
    };
  }
}
