FROM node:20-alpine AS base

# 支持通过构建参数选择 APK 镜像源（默认官方，国内用户可传入 MIRROR=cn）
ARG MIRROR=official
RUN if [ "$MIRROR" = "cn" ]; then \
        echo "Using China mirror (阿里云)..." && \
        sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories; \
    elif [ "$MIRROR" = "global" ]; then \
        echo "Using global mirror..." && \
        sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories; \
    else \
        echo "Using official mirror..."; \
    fi && \
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
