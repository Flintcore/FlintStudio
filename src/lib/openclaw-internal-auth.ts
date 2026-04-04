import { isValidAdvanceBearer } from "@/lib/internal-task-token";

/** OpenClaw / 内部服务使用的 Bearer，与 Worker advance 令牌一致（环境变量或设置页数据库） */
export async function verifyOpenclawBearer(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return isValidAdvanceBearer(token);
}
