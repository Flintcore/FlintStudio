/**
 * 画风（视觉风格）配置：用于一键成片时统一分镜描述与出图风格。
 * 启动工作流时选择，写入 run.input.visualStyle，分镜与出图阶段读取并应用。
 */

export type VisualStyleId =
  | "live_action"
  | "unreal_cg"
  | "manhua"
  | "anime"
  | "donghua_3d"
  | "cinematic"
  | "american_comic"
  | "default";

export interface VisualStyleOption {
  id: VisualStyleId;
  /** 中文展示名 */
  labelZh: string;
  /** 英文展示名 */
  labelEn: string;
  /** 给 LLM 的风格说明，用于分镜 prompt */
  descriptionForLlm: string;
  /** 出图时追加到 imagePrompt 的英文后缀，保证风格一致 */
  promptSuffixForImage: string;
}

export const VISUAL_STYLES: VisualStyleOption[] = [
  {
    id: "default",
    labelZh: "默认（由 AI 自由发挥）",
    labelEn: "Default (AI decides)",
    descriptionForLlm: "不强制统一风格，根据剧情自然选择电影感或动画感。",
    promptSuffixForImage: "",
  },
  {
    id: "live_action",
    labelZh: "写实实拍",
    labelEn: "Live-action / Photorealistic",
    descriptionForLlm:
      "写实实拍风格：真人电影质感、实景摄影、自然光与电影布光、摄影机运动真实感。imagePrompt 需使用英文，并包含 photorealistic, live-action, cinematic lighting, film grain 等关键词。",
    promptSuffixForImage:
      ", photorealistic, live-action film, cinematic lighting, film grain, 8k",
  },
  {
    id: "unreal_cg",
    labelZh: "3D 虚幻引擎游戏 CG",
    labelEn: "Unreal Engine / Game CG",
    descriptionForLlm:
      "3D 虚幻引擎/游戏 CG 风格：高精度 3D 渲染、游戏过场动画质感、PBR 材质、戏剧光影。imagePrompt 需使用英文，并包含 Unreal Engine 5, game cinematic, high quality 3D render, PBR 等关键词。",
    promptSuffixForImage:
      ", Unreal Engine 5, game cinematic, high quality 3D render, PBR, dramatic lighting",
  },
  {
    id: "manhua",
    labelZh: "漫剧 / 条漫",
    labelEn: "Manhua / Webtoon",
    descriptionForLlm:
      "漫剧/条漫风格：条漫分镜、清爽线稿、网漫上色、适合竖屏。imagePrompt 需使用英文，并包含 manhua style, webtoon, clean line art, vertical comic 等关键词。",
    promptSuffixForImage:
      ", manhua style, webtoon, clean line art, vibrant colors, vertical comic",
  },
  {
    id: "anime",
    labelZh: "日式动画",
    labelEn: "Anime",
    descriptionForLlm:
      "日式动画风格：2D 动画、赛璐璐/数字动画质感、大眼睛、典型动画光影与构图。imagePrompt 需使用英文，并包含 anime style, 2D animation, cel-shading, Japanese animation 等关键词。",
    promptSuffixForImage:
      ", anime style, 2D animation, cel-shading, Japanese animation, high quality",
  },
  {
    id: "donghua_3d",
    labelZh: "3D 国漫 / 修仙",
    labelEn: "Chinese 3D Donghua",
    descriptionForLlm:
      "中国 3D 国漫/修仙风格：国产 3D 动画质感、仙侠/修真场景、精细建模、灵气特效。imagePrompt 需使用英文，并包含 Chinese 3D donghua, xianxia, fantasy, detailed character model, magical effects 等关键词。",
    promptSuffixForImage:
      ", Chinese 3D donghua style, xianxia, fantasy, detailed 3D character, magical effects, elegant",
  },
  {
    id: "cinematic",
    labelZh: "电影感（通用）",
    labelEn: "Cinematic (general)",
    descriptionForLlm:
      "通用电影感：电影级构图、景深、调色与光影，风格介于写实与艺术之间。imagePrompt 需使用英文，并包含 cinematic, movie still, dramatic lighting, color grading 等关键词。",
    promptSuffixForImage:
      ", cinematic, movie still, dramatic lighting, color grading, 8k",
  },
  {
    id: "american_comic",
    labelZh: "美漫 / 美式漫画",
    labelEn: "American comic",
    descriptionForLlm:
      "美漫/美式漫画风格：粗线条、强对比、漫画分镜与网点。imagePrompt 需使用英文，并包含 American comic style, bold lines, high contrast, comic book 等关键词。",
    promptSuffixForImage:
      ", American comic style, bold lines, high contrast, comic book art",
  },
];

const byId = new Map<VisualStyleId, VisualStyleOption>(
  VISUAL_STYLES.map((s) => [s.id, s])
);

export function getVisualStyleById(
  id: string | null | undefined
): VisualStyleOption | null {
  if (!id || typeof id !== "string") return null;
  return byId.get(id as VisualStyleId) ?? null;
}

/** 出图时根据画风 ID 得到要追加到 prompt 的英文后缀；无画风或 default 返回空字符串 */
export function getImagePromptSuffix(
  visualStyleId: string | null | undefined
): string {
  const style = getVisualStyleById(visualStyleId);
  if (!style || style.id === "default") return "";
  return style.promptSuffixForImage;
}

/** 校验是否为合法画风 ID；用于 API 与前端 */
export function isValidVisualStyleId(
  id: string | null | undefined
): id is VisualStyleId {
  return typeof id === "string" && byId.has(id as VisualStyleId);
}
