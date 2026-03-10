/**
 * 剧本分析提示词 - 优化版
 * 参考：AI导演工作流 · 第一层：剧本分析
 */

export const ANALYZE_NOVEL_SYSTEM = `你是一位资深的剧本分析专家，擅长从小说或剧本原文中提取结构化信息。

## 核心任务
分析用户提供的小说/剧本内容，提取以下结构化信息：
1. **角色信息**：所有出场角色的完整视觉设定
2. **场景信息**：故事发生的主要地点/场景的空间特征
3. **剧情结构**：将故事合理划分为多集，每集有完整的起承转合

## 输出格式（严格 JSON，不要包含其他说明文字）

\`\`\`json
{
  "characters": [
    {
      "name": "角色名称（使用全名或主要称谓）",
      "description": "角色详细描述，包含：外貌特征（脸型/眼型/发型/体型）、身份背景、服装风格、标志性特征",
      "traits": ["性格特点1", "性格特点2", "性格特点3", "性格特点4"]
    }
  ],
  "locations": [
    {
      "name": "场景名称（统一命名，如「沈府·书房」而非「书房」）",
      "description": "场景详细描述，包含：空间类型（室内/室外）、尺度感（狭小/正常/开阔）、关键物件、光源设定、时代地域特征"
    }
  ],
  "episodes": [
    {
      "episodeNumber": 1,
      "title": "本集标题（15-25字，概括核心冲突）",
      "summary": "本集一句话摘要（30-60字，包含起承转合）",
      "content": "本集完整正文内容（保留原文，不删减）"
    }
  ]
}
\`\`\`

## 角色提取规范

**必须包含的视觉信息（用于后续生图一致性）**：
- 性别/年龄外观
- 面部特征：脸型、眼型与颜色、眉形、鼻型、唇形、肤色
- 发型发色：长度、造型、颜色、质感
- 体型：身高感、体态、肩宽、体格
- 服装设定：款式、材质、颜色、细节（纽扣/褶皱/图案）
- 配饰：首饰、眼镜、帽子、武器等
- 视觉锚点（3个最突出的识别特征）

**性格特点提取**：
- 用3-5个关键词概括
- 避免抽象词，优先选择可通过表演呈现的特点

## 场景提取规范

**必须包含的空间信息**：
- 类型：室内/室外/半开放
- 尺度感：狭小密闭/正常室内/开阔/恢弘
- 主要建筑/地形特征
- 关键物件（必须出现在画面中的道具/家具/地标）
- 光源设定：主光源类型、方向、色温倾向
- 时代与地域特征（影响建筑、服装、道具、植被）

## 分集策略

**分集原则**：
1. **每集独立性**：每集应有完整的起承转合，包含至少一个情节点
2. **节奏控制**：每集字数建议在3000-8000字之间
3. **悬念设置**：每集结尾可设置悬念，吸引观众继续观看
4. **高潮分布**：重要情节和高潮应均匀分布到各集
5. **场景集中**：同一场景的连续戏份尽量放在同一集

**标题要求**：
- 15-25字
- 概括本集核心冲突或亮点
- 避免剧透关键反转

**摘要要求**：
- 30-60字
- 包含：主要角色 + 核心事件 + 冲突/转折
- 示例：「沈大人得知太子被废，连夜入宫求见丞相，却意外撞见神秘黑衣人，卷入一场宫廷阴谋」

## 约束条件

1. **角色去重**：合并同一角色的不同称呼（如："张三"、"张公子"、"他"指同一人）
2. **场景统一**：相似场景应合并（如："皇宫大殿"、"殿内"应统一）
3. **分集边界**：确保每集内容完整，不中途截断关键情节
4. **编号规范**：episodeNumber 从1开始连续编号
5. **JSON格式**：确保输出是严格的 JSON 格式，可以被正常解析`;

export interface AnalyzeNovelOptions {
  /** 期望的分集数量，不指定则自动判断 */
  targetEpisodes?: number;
  /** 每集最小字数 */
  minEpisodeLength?: number;
  /** 每集最大字数 */
  maxEpisodeLength?: number;
  /** 故事类型/题材，如：古装、现代、悬疑、爱情等 */
  genre?: string;
}

/**
 * 构建剧本分析的用户提示词
 * @param novelContent 小说/剧本原文
 * @param options 分析选项
 * @returns 用户提示词
 */
export function buildAnalyzeNovelUserPrompt(
  novelContent: string,
  options: AnalyzeNovelOptions = {}
): string {
  const {
    targetEpisodes,
    minEpisodeLength = 3000,
    maxEpisodeLength = 8000,
    genre,
  } = options;

  const text = novelContent.slice(0, 50000).trim();

  let optionsText = "";
  if (targetEpisodes) {
    optionsText += `\n- 请将故事划分为 ${targetEpisodes} 集`;
  }
  if (genre) {
    optionsText += `\n- 故事类型：${genre}（请在角色服装、场景描述中体现该类型特点）`;
  }

  return `请分析以下小说/剧本内容，提取角色、场景信息，并合理划分剧集。

## 分析要求
- 每集字数控制在 ${minEpisodeLength}-${maxEpisodeLength} 字之间${optionsText}
- 角色描述必须包含完整的视觉设定（外貌、服装、标志性特征），用于后续AI生成一致性图像
- 场景描述必须包含空间结构和光源设定，用于后续生图
- 分集标题要吸引人，能概括本集核心内容
- 确保同一场景使用统一的场景名称

## 小说/剧本内容

${text}

## 输出要求
请严格按照系统指令中的 JSON 格式返回分析结果，确保：
1. 包含 characters、locations、episodes 三个字段
2. 角色描述详细到可用于生图（外貌、服装、特征）
3. 场景描述包含空间感和光源信息
4. episodeNumber 从 1 开始连续编号
5. 确保 JSON 格式正确，可以被正常解析`;
}

/**
 * 构建针对已有角色和场景的增量分析提示词
 * @param novelContent 新增的小说/剧本内容
 * @param existingCharacters 已有角色列表
 * @param existingLocations 已有场景列表
 * @param currentEpisodeCount 当前已分析的集数
 * @returns 用户提示词
 */
export function buildAnalyzeNovelIncrementalUserPrompt(
  novelContent: string,
  existingCharacters: { name: string; description: string; traits: string[] }[],
  existingLocations: { name: string; description: string }[],
  currentEpisodeCount: number
): string {
  const text = novelContent.slice(0, 50000).trim();

  const charactersText = existingCharacters.length
    ? existingCharacters
        .map(
          (c) =>
            `- ${c.name}：${c.description}（特点：${c.traits.join("、")}）`
        )
        .join("\n")
    : "无";

  const locationsText = existingLocations.length
    ? existingLocations.map((l) => `- ${l.name}：${l.description}`).join("\n")
    : "无";

  return `请继续分析以下小说/剧本内容，提取新的角色和场景，并划分后续剧集。

## 已有信息（用于参考，避免重复）

### 已有角色
${charactersText}

### 已有场景
${locationsText}

### 已分析集数
已分析至第 ${currentEpisodeCount} 集，请继续分析第 ${currentEpisodeCount + 1} 集及之后的内容

## 新增内容

${text}

## 输出要求
请严格按照系统指令中的 JSON 格式返回分析结果。注意：
1. 只返回新增的角色和场景（已有角色/场景如有新信息可补充）
2. episodeNumber 从 ${currentEpisodeCount + 1} 开始编号
3. 保持与已有分析的风格和格式一致
4. 新角色描述同样要包含完整的视觉设定`;
}
