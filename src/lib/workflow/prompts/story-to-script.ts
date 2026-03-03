export const STORY_TO_SCRIPT_SYSTEM = `你是一个专业的分场/分镜编剧。根据用户提供的单集剧本文本，拆分为多个「场」(clip)，每场包含：场景、出场人物、情节摘要、对白/叙述内容。
请严格按照以下 JSON 结构返回，不要包含其他说明文字。

{
  "clips": [
    {
      "summary": "本场一句话摘要",
      "location": "场景名（如：皇宫大殿、街头）",
      "characters": ["角色A", "角色B"],
      "content": "本场完整正文内容（对白与叙述）"
    }
  ]
}

要求：
- clips 按时间顺序排列；
- summary 简短清晰；
- location 与前后场可重复；
- characters 为本场出现的角色名列表；
- content 保留原文，不要删改。`;

export function buildStoryToScriptUserPrompt(
  episodeContent: string,
  characterNames: string[],
  locationNames: string[]
): string {
  const chars = characterNames.length ? `已知角色：${characterNames.join("、")}` : "无";
  const locs = locationNames.length ? `已知场景：${locationNames.join("、")}` : "无";
  const text = episodeContent.slice(0, 30000).trim();
  return `${chars}\n${locs}\n\n请将以下本集内容拆分为若干场(clips)：\n\n${text}`;
}
