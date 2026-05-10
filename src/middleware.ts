import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n";

// 创建 next-intl 中间件
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: true,
});

export default function middleware(request: NextRequest) {
  // API 请求日志
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const start = Date.now();
    const requestId = crypto.randomUUID();

    // 记录请求开始
    console.log(
      JSON.stringify({
        type: "request_start",
        requestId,
        method: request.method,
        url: request.url,
        timestamp: new Date().toISOString(),
      })
    );

    // 添加响应头用于追踪
    const response = intlMiddleware(request);
    response.headers.set("x-request-id", requestId);

    // 记录响应时间（通过响应头传递）
    const duration = Date.now() - start;
    response.headers.set("x-response-time", `${duration}ms`);

    return response;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/",
    "/(zh|en)/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico)$).*)",
  ],
};
