FROM node:20-alpine AS base

# 使用国内镜像源加速 APK 下载（解决 DNS 解析失败问题）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# 容器内无 .env（被 .dockerignore 排除），Worker 的 tsx --env-file=.env 需要文件存在；环境变量由 docker-compose 注入
RUN touch .env
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate 2>/dev/null || true && npm run start"]
