/**
 * Next.js 启动时执行
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  const { validateEnv } = await import("@/lib/env");
  validateEnv();
}
