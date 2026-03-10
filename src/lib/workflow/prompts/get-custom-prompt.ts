import { prisma } from "@/lib/db";

export interface CustomPrompts {
  analyzeNovelSystem?: string;
  storyToScriptSystem?: string;
  scriptToStoryboardSystem?: string;
  voiceExtractSystem?: string;
}

const CACHE_TTL = 60 * 1000; // 1分钟缓存

interface CacheEntry {
  prompts: CustomPrompts;
  timestamp: number;
}

const customPromptCache = new Map<string, CacheEntry>();

/**
 * 获取用户的自定义提示词
 * @param userId 用户ID
 * @returns 自定义提示词配置
 */
export async function getCustomPrompts(userId: string): Promise<CustomPrompts> {
  // 检查缓存
  const cached = customPromptCache.get(userId) as CacheEntry | undefined;
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.prompts;
  }

  try {
    const prefs = await prisma.userPreference.findUnique({
      where: { userId },
      select: { customPrompts: true },
    });

    const prompts = parseCustomPrompts(prefs?.customPrompts);
    
    // 更新缓存
    customPromptCache.set(userId, { prompts, timestamp: Date.now() });
    
    return prompts;
  } catch (error) {
    console.error("[getCustomPrompts] 获取失败:", error);
    return {};
  }
}

function parseCustomPrompts(raw: string | null | undefined): CustomPrompts {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as CustomPrompts;
  } catch {
    return {};
  }
}

/**
 * 清除用户的提示词缓存
 * @param userId 用户ID
 */
export function clearPromptCache(userId: string): void {
  customPromptCache.delete(userId);
}

/**
 * 获取特定类型的系统提示词（优先使用自定义，否则使用默认）
 * @param userId 用户ID
 * @param type 提示词类型
 * @param defaultPrompt 默认提示词
 * @returns 最终使用的提示词
 */
export async function getSystemPrompt(
  userId: string,
  type: keyof CustomPrompts,
  defaultPrompt: string
): Promise<string> {
  const custom = await getCustomPrompts(userId);
  return custom[type]?.trim() || defaultPrompt;
}
