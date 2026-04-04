import { env } from "@/lib/env";
import { getOrCreateDefaultUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function isPlaceholderToken(t: string): boolean {
  return t.includes("please-change");
}

/** 环境变量中的令牌是否可用（非空且非示例占位） */
export function envInternalTaskTokenUsable(): boolean {
  const t = env.INTERNAL_TASK_TOKEN?.trim();
  return !!t && !isPlaceholderToken(t);
}

/**
 * 解析 Worker → Next 推进 API 使用的 Bearer 令牌。
 * 优先 `INTERNAL_TASK_TOKEN` 环境变量；否则读默认用户在设置中保存的 `internalTaskToken`。
 */
export async function resolveInternalTaskToken(): Promise<string> {
  if (envInternalTaskTokenUsable()) {
    return env.INTERNAL_TASK_TOKEN.trim();
  }
  const user = await getOrCreateDefaultUser();
  const pref = await prisma.userPreference.findUnique({
    where: { userId: user.id },
    select: { internalTaskToken: true },
  });
  const db = pref?.internalTaskToken?.trim();
  if (db && !isPlaceholderToken(db)) {
    return db;
  }
  throw new Error(
    "缺少 Worker 内部通信令牌：请在 .env 设置 INTERNAL_TASK_TOKEN，或在「设置 → API 配置」中填写「Worker 内部令牌」并保存"
  );
}

/** 校验 advance 请求的 Bearer 是否与 env 或数据库中配置的令牌一致 */
export async function isValidAdvanceBearer(token: string): Promise<boolean> {
  const trimmed = token?.trim();
  if (!trimmed) return false;
  if (envInternalTaskTokenUsable() && trimmed === env.INTERNAL_TASK_TOKEN.trim()) {
    return true;
  }
  try {
    const user = await getOrCreateDefaultUser();
    const pref = await prisma.userPreference.findUnique({
      where: { userId: user.id },
      select: { internalTaskToken: true },
    });
    const db = pref?.internalTaskToken?.trim();
    return !!db && !isPlaceholderToken(db) && trimmed === db;
  } catch {
    return false;
  }
}
