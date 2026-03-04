import { llmJson } from "@/lib/llm/client";

const REVIEW_SYSTEM = `你是一个剧本分析质检 Agent。请根据「剧本分析」的输出做简要复查，判断：
1. 是否至少包含 1 集（episodes 非空）；
2. 角色与场景是否与剧情相关（非空、非无意义占位）。
仅返回 JSON：{ "ok": boolean, "issues": string[] }。若通过则 ok 为 true、issues 为空数组；若有问题则 ok 为 false，issues 列出具体问题（简短一句一条）。`;

export type ReviewResult = { ok: boolean; issues: string[] };

export async function runReviewAnalysis(opts: {
  userId: string;
  episodeCount: number;
  characterCount: number;
  locationCount: number;
}): Promise<ReviewResult> {
  const { userId, episodeCount, characterCount, locationCount } = opts;
  const json = await llmJson<{ ok?: boolean; issues?: string[] }>(
    userId,
    REVIEW_SYSTEM,
    `当前剧本分析结果：共 ${episodeCount} 集、${characterCount} 个角色、${locationCount} 个场景。请复查并返回 { "ok": boolean, "issues": string[] }。`,
    { temperature: 0.1 }
  );
  const ok = json?.ok === true;
  const issues = Array.isArray(json?.issues) ? json.issues : [];
  return { ok, issues };
}
