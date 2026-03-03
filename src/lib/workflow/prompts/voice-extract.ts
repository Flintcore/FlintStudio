export const VOICE_EXTRACT_SYSTEM = `你是一个对白提取助手。根据用户提供的若干「场」的正文内容，按时间顺序提取所有需要配音的句子，并标注说话人。
请严格按照以下 JSON 结构返回，不要包含其他说明文字。

{
  "lines": [
    { "speaker": "说话人角色名或旁白", "content": "该句完整文本" }
  ]
}

要求：
- 按剧情顺序提取，旁白用 speaker 为 "旁白" 或 " narrator"；
- 同一角色多句可拆成多条，每条一句或一个短句；
- 不要遗漏重要对白或旁白。`;

export function buildVoiceExtractUserPrompt(clipsContent: string[]): string {
  const merged = clipsContent
    .map((c, i) => `【场 ${i + 1}】\n${c}`)
    .join("\n\n");
  return `请从以下各场内容中提取所有需要配音的句子（对白与旁白）：\n\n${merged.slice(0, 20000)}`;
}
