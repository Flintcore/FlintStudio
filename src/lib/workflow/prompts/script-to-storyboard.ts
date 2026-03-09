export const SCRIPT_TO_STORYBOARD_SYSTEM = `你是一个分镜师。根据一场戏的 content，拆分为多个镜头(panel)，每个镜头对应一张分镜图。
请严格按照以下 JSON 结构返回，不要包含其他说明文字。

{
  "panels": [
    {
      "description": "画面描述（人物、动作、景别）",
      "imagePrompt": "适合 AI 绘图的英文提示词，描述画面风格与内容",
      "location": "场景名",
      "characters": ["本镜头出现的角色名"]
    }
  ]
}

要求：
- panels 按时间顺序，一般 3～9 个镜头；
- description 用于理解剧情；
- imagePrompt 英文、具体、含风格（如 cinematic, anime），便于图像生成。`;

import { getVisualStyleById } from "../visual-style";

/** 若指定画风，在 system 中追加统一风格说明，使所有 imagePrompt 一致符合该风格 */
export function buildScriptToStoryboardSystem(visualStyleId?: string | null): string {
  const style = getVisualStyleById(visualStyleId);
  if (!style || style.id === "default") return SCRIPT_TO_STORYBOARD_SYSTEM;
  return `${SCRIPT_TO_STORYBOARD_SYSTEM}

【本片统一视觉风格】
${style.descriptionForLlm}
请确保所有 panel 的 imagePrompt 都严格符合上述风格，并保持整场/整集风格一致。`;
}

export function buildScriptToStoryboardUserPrompt(clipContent: string): string {
  const text = clipContent.slice(0, 8000).trim();
  return `请将以下这场戏拆分为分镜镜头(panels)：\n\n${text}`;
}
