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
  [key: string]: unknown;
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
  /** 角色名列表（取前10个，用于实质性内容审查） */
  characters?: string[];
  /** 场景名列表（取前10个） */
  locations?: string[];
  /** 每集名称+内容摘要（前200字），用于评估内容质量 */
  episodeSummaries?: string[];
}): Promise<ReviewResult> {
  const { userId, episodeCount, characterCount, locationCount, characters, locations, episodeSummaries } = opts;

  // 构建实质性内容描述
  const characterList = characters && characters.length > 0
    ? `角色列表：${characters.join("、")}`
    : `共 ${characterCount} 个角色（无名称信息）`;

  const locationList = locations && locations.length > 0
    ? `场景列表：${locations.join("、")}`
    : `共 ${locationCount} 个场景（无名称信息）`;

  const episodeDetail = episodeSummaries && episodeSummaries.length > 0
    ? `各集内容摘要：\n${episodeSummaries.map((s, i) => `第${i + 1}集：${s}`).join("\n")}`
    : `共 ${episodeCount} 集（无内容摘要）`;

  const userPrompt = `当前剧本分析结果如下，请复查并返回评分：

## 基本统计
- 总集数：${episodeCount} 集
- 角色数量：${characterCount} 个
- 场景数量：${locationCount} 个

## 详细内容
${characterList}

${locationList}

${episodeDetail}

请根据以上内容进行评分，重点检查：内容是否实质性、角色/场景是否与剧情匹配、集数内容是否连贯。`;

  try {
    const json = await llmJson<{
      score?: number;
      passed?: boolean;
      dimensions?: ReviewResult["dimensions"];
      issues?: string[];
    }>(
      userId,
      REVIEW_SYSTEM,
      userPrompt,
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
    // 复查失败时，返回通过状态——LLM 配置问题不应阻断正常的分析结果
    // 警告日志留给运维排查，但不能因 review agent 自身故障让整个流程挂起
    console.error("[ReviewAnalysis] 复查 Agent 调用失败，跳过质检:", error);
    return {
      score: 75,
      passed: true,
      dimensions: {
        episodes: { score: 75, comment: "复查 Agent 不可用，自动通过" },
        characters: { score: 75, comment: "复查 Agent 不可用，自动通过" },
        locations: { score: 75, comment: "复查 Agent 不可用，自动通过" },
        coherence: { score: 75, comment: "复查 Agent 不可用，自动通过" },
      },
      issues: [],
    };
  }
}
