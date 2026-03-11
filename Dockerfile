# ============================================
# FlintStudio Dockerfile - 多阶段构建优化版
# ============================================

# 基础阶段
FROM node:20-alpine AS base

# 安装必要依赖
RUN apk add --no-cache ffmpeg

WORKDIR /app

# 依赖安装阶段 - 优化缓存
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit

# 构建阶段
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 创建空 .env 文件（环境变量由 docker-compose 注入）
RUN touch .env

# 生成 Prisma Client 和构建
RUN npx prisma generate && npm run build

# 生产阶段 - 最小化镜像
FROM base AS runner
ENV NODE_ENV=production

# 仅复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

# 启动命令：数据库迁移后启动
CMD ["sh", "-c", "npx prisma db push --skip-generate 2>/dev/null || true && node server.js"]
