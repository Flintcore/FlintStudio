/**
 * 应用性能指标收集
 * 用于监控关键性能指标 (Core Web Vitals)
 */

import { logger } from "./logger";

interface Metric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta?: number;
  entries?: PerformanceEntry[];
}

type MetricHandler = (metric: Metric) => void;

const observers: Map<string, PerformanceObserver> = new Map();
const handlers: Set<MetricHandler> = new Set();

/**
 * 添加指标处理器
 */
export function onMetric(handler: MetricHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/**
 * 报告指标
 */
function reportMetric(metric: Metric) {
  logger.debug(
    {
      type: "web_vital",
      name: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating,
    },
    `${metric.name}: ${Math.round(metric.value)} (${metric.rating})`
  );

  handlers.forEach((handler) => {
    try {
      handler(metric);
    } catch {
      // 忽略处理器错误
    }
  });
}

/**
 * 获取指标评级
 */
function getRating(name: string, value: number): Metric["rating"] {
  const thresholds: Record<string, [number, number]> = {
    CLS: [0.1, 0.25],
    FID: [100, 300],
    LCP: [2500, 4000],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
    INP: [200, 500],
  };

  const [good, poor] = thresholds[name] || [0, 0];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

/**
 * 监控 Web Vitals
 */
export function observeWebVitals() {
  if (typeof window === "undefined") return;

  // Largest Contentful Paint
  if ("PerformanceObserver" in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
          renderTime?: number;
          loadTime?: number;
        };
        const value = lastEntry.renderTime || lastEntry.loadTime || 0;

        reportMetric({
          name: "LCP",
          value,
          rating: getRating("LCP", value),
          entries,
        });
      });

      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
      observers.set("LCP", lcpObserver);
    } catch {
      // 浏览器不支持
    }

    // First Input Delay (使用 Event Timing API)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const firstEntry = entries[0] as PerformanceEntry & {
          processingStart?: number;
          startTime?: number;
        };
        if (firstEntry.processingStart && firstEntry.startTime) {
          const value = firstEntry.processingStart - firstEntry.startTime;

          reportMetric({
            name: "FID",
            value,
            rating: getRating("FID", value),
            entries,
          });
        }
      });

      fidObserver.observe({ entryTypes: ["first-input"] });
      observers.set("FID", fidObserver);
    } catch {
      // 浏览器不支持
    }

    // Cumulative Layout Shift
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEntry[];
        entries.forEach((entry) => {
          const layoutShift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!layoutShift.hadRecentInput && layoutShift.value) {
            clsValue += layoutShift.value;
          }
        });

        reportMetric({
          name: "CLS",
          value: clsValue,
          rating: getRating("CLS", clsValue),
          entries,
        });
      });

      clsObserver.observe({ entryTypes: ["layout-shift"] });
      observers.set("CLS", clsObserver);
    } catch {
      // 浏览器不支持
    }

    // First Contentful Paint
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const firstEntry = entries[0] as PerformanceEntry & {
          startTime?: number;
        };
        if (firstEntry.startTime) {
          reportMetric({
            name: "FCP",
            value: firstEntry.startTime,
            rating: getRating("FCP", firstEntry.startTime),
            entries,
          });
        }
      });

      fcpObserver.observe({ entryTypes: ["paint"] });
      observers.set("FCP", fcpObserver);
    } catch {
      // 浏览器不支持
    }
  }

  // Time to First Byte (使用 Navigation Timing)
  if (typeof window !== "undefined" && window.performance) {
    const navigation =
      window.performance.getEntriesByType("navigation")[0];
    if (navigation) {
      const navTiming = navigation as PerformanceNavigationTiming;
      const value = navTiming.responseStart;

      reportMetric({
        name: "TTFB",
        value,
        rating: getRating("TTFB", value),
      });
    }
  }
}

/**
 * 获取当前性能指标摘要
 */
export function getMetricsSummary(): Record<string, number> {
  if (typeof window === "undefined") return {};

  const navigation =
    window.performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;

  if (!navigation) return {};

  return {
    dns: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
    tcp: Math.round(navigation.connectEnd - navigation.connectStart),
    ttfb: Math.round(navigation.responseStart),
    download: Math.round(navigation.responseEnd - navigation.responseStart),
    domParse: Math.round(
      navigation.domInteractive - navigation.responseEnd
    ),
    domReady: Math.round(navigation.domContentLoadedEventEnd),
    loadComplete: Math.round(navigation.loadEventEnd),
  };
}

/**
 * 清理所有观察者
 */
export function disconnectObservers() {
  observers.forEach((observer) => observer.disconnect());
  observers.clear();
  handlers.clear();
}
