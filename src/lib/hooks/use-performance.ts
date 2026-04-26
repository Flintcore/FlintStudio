/**
 * 性能监控 Hook
 * 用于追踪组件渲染时间和内存使用
 */

import { useEffect, useRef, useCallback } from "react";
import { logger } from "@/lib/logger";

interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  mountTime: number;
}

/**
 * 追踪组件渲染性能
 * @param componentName 组件名称（用于日志标识）
 * @param enabled 是否启用（开发环境默认启用）
 */
export function useRenderPerformance(componentName: string, enabled = process.env.NODE_ENV === "development") {
  const metricsRef = useRef<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    mountTime: Date.now(),
  });
  const renderStartRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    renderStartRef.current = performance.now();

    return () => {
      const renderTime = performance.now() - renderStartRef.current;
      const metrics = metricsRef.current;
      metrics.renderCount++;
      metrics.lastRenderTime = renderTime;
      metrics.averageRenderTime =
        (metrics.averageRenderTime * (metrics.renderCount - 1) + renderTime) / metrics.renderCount;

      // 慢渲染警告（>100ms）
      if (renderTime > 100) {
        logger.warn(
          {
            type: "slow_render",
            component: componentName,
            renderTime: Math.round(renderTime),
            renderCount: metrics.renderCount,
          },
          `Slow render: ${componentName} took ${Math.round(renderTime)}ms`
        );
      }
    };
  });

  const getMetrics = useCallback(() => ({ ...metricsRef.current }), []);

  return { metrics: metricsRef.current, getMetrics };
}

/**
 * 防抖 Hook
 */
export function useDebounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}

/**
 * 节流 Hook
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  const inThrottleRef = useRef(false);

  return useCallback(
    (...args: Parameters<T>) => {
      if (!inThrottleRef.current) {
        fn(...args);
        inThrottleRef.current = true;
        setTimeout(() => (inThrottleRef.current = false), limit);
      }
    },
    [fn, limit]
  );
}

/**
 * 虚拟列表计算 Hook
 */
export function useVirtualList<T>(
  items: T[],
  options: {
    itemHeight: number;
    overscan?: number;
    containerHeight: number;
  }
) {
  const { itemHeight, overscan = 5, containerHeight } = options;
  const scrollTopRef = useRef(0);

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const totalHeight = items.length * itemHeight;

  const getVisibleRange = useCallback(
    (scrollTop: number) => {
      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(startIndex + visibleCount + overscan, items.length);
      const startOffset = Math.max(startIndex - overscan, 0);

      return {
        startIndex: startOffset,
        endIndex,
        offsetY: startOffset * itemHeight,
      };
    },
    [itemHeight, visibleCount, overscan, items.length]
  );

  const visibleItems = useCallback(
    (scrollTop: number) => {
      const { startIndex, endIndex } = getVisibleRange(scrollTop);
      return items.slice(startIndex, endIndex).map((item, index) => ({
        item,
        index: startIndex + index,
        style: {
          position: "absolute" as const,
          top: (startIndex + index) * itemHeight,
          height: itemHeight,
          left: 0,
          right: 0,
        },
      }));
    },
    [items, itemHeight, getVisibleRange]
  );

  return {
    totalHeight,
    visibleItems,
    getVisibleRange,
  };
}
