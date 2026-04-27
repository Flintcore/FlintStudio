/**
 * Service Worker 注册 Hook
 * 用于启用 PWA 离线支持
 */

import { useEffect, useState } from "react";
import { logger } from "../logger";

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  error?: string;
}

/**
 * 注册 Service Worker
 */
export function useServiceWorker(): ServiceWorkerState {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator)) {
      logger.debug(
        { type: "sw" },
        "Service Worker not supported"
      );
      return;
    }

    setState((prev) => ({ ...prev, isSupported: true }));

    let isMounted = true;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (!isMounted) return;

        logger.info(
          {
            type: "sw",
            scope: registration.scope,
          },
          "Service Worker registered"
        );

        setState({
          isSupported: true,
          isRegistered: true,
        });

        // 监听更新
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                logger.info(
                  { type: "sw" },
                  "New Service Worker available"
                );
              }
            });
          }
        });
      })
      .catch((error) => {
        if (!isMounted) return;

        logger.error(
          {
            type: "sw",
            error: error.message,
          },
          "Service Worker registration failed"
        );

        setState({
          isSupported: true,
          isRegistered: false,
          error: error.message,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}

/**
 * 手动触发 Service Worker 更新检查
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  const registration = await navigator.serviceWorker.ready;
  await registration.update();

  return !!registration.waiting;
}

/**
 * 跳过等待，激活新 Service Worker
 */
export async function skipWaiting(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}
