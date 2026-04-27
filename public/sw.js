/**
 * Service Worker for FlintStudio
 * 提供离线支持和资源缓存
 */

const CACHE_NAME = "flintstudio-v1";
const STATIC_ASSETS = [
  "/",
  "/zh",
  "/workspace",
  "/settings",
];

// 安装时缓存静态资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(() => {
        // 缓存失败时静默处理
      })
  );
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// 拦截 fetch 请求
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过 API 请求
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 跳过非 GET 请求
  if (request.method !== "GET") {
    return;
  }

  // 静态资源缓存策略：优先缓存
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    url.pathname.startsWith("/_next/")
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request)
          .then((networkResponse) => {
            // 缓存新资源
            if (networkResponse.ok) {
              const clonedResponse = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clonedResponse);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // 网络失败时返回离线页面
            if (request.destination === "document") {
              return caches.match("/");
            }
            throw new Error("Network error");
          });
      })
    );
    return;
  }

  // 页面缓存策略：网络优先，失败时回退缓存
  if (request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match("/");
          });
        })
    );
    return;
  }

  // 默认：缓存优先
  event.respondWith(
    caches.match(request).then((response) => {
      return (
        response ||
        fetch(request).catch(() => {
          return new Response("Network error", { status: 408 });
        })
      );
    })
  );
});
