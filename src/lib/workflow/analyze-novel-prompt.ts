export const ANALYZE_NOVEL_SYSTEM = `你是一个专业的剧本分析助手。根据用户提供的小说或剧本文本，提取结构化信息。
请严格按照以下 JSON 结构返回，不要包含其他说明文字。

{
  "characters": [
    { "name": "角色名", "description": "外貌与性格简要描述" }
  ],
  "locations": [
    { "name": "场景名", "summary": "场景简要描述" }
  ],
  "episodes": [
    { "episodeNumber": 1, "name": "集标题", "content": "该集完整正文内容" }
  ]
}

要求：
- characters: 出现的主要角色，name 必填，description 简短
- locations: 主要场景/地点
- episodes: 按集拆分，episodeNumber 从 1 开始递增，name 可为空，content 为该集全文
- 若原文未分集，则整篇作为一集（episodeNumber: 1）`;

export function buildAnalyzeNovelUserPrompt(novelText: string): string {
  const trimmed = novelText.slice(0, 50000).trim();
  return `请分析以下小说/剧本并提取角色、场景和集数信息：\n\n${trimmed}`;
}
