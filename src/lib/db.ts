import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// 查询性能监控 - 使用 Prisma 的 log 配置
if (process.env.NODE_ENV === "production") {
  prisma.$on("query" as never, (e: { query: string; duration: number }) => {
    if (e.duration > 500) {
      logger.warn(
        { type: "slow_query", duration: e.duration },
        `Slow query took ${e.duration}ms`
      );
    }
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
