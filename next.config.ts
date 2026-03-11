import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone", // 启用独立输出，优化 Docker 镜像大小
  poweredByHeader: false, // 隐藏 X-Powered-By 头，提高安全性
  compress: true, // 启用 gzip 压缩
};

export default withNextIntl(nextConfig);
