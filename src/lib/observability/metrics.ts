/**
 * 指标收集与监控
 * 收集关键性能指标，支持 Prometheus 格式导出
 */

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface CounterMetric {
  name: string;
  help: string;
  type: "counter";
  values: Map<string, number>; // key: labels hash, value: count
}

export interface GaugeMetric {
  name: string;
  help: string;
  type: "gauge";
  values: Map<string, { value: number; timestamp: number }>;
}

export interface HistogramMetric {
  name: string;
  help: string;
  type: "histogram";
  buckets: number[];
  values: Map<string, number[]>; // key: labels hash, value: bucket counts
}

type Metric = CounterMetric | GaugeMetric | HistogramMetric;

// 内存中的指标存储
const metricsStore = new Map<string, Metric>();

/**
 * 创建或获取 Counter 指标
 */
export function createCounter(name: string, help: string): CounterMetric {
  if (!metricsStore.has(name)) {
    const metric: CounterMetric = {
      name,
      help,
      type: "counter",
      values: new Map(),
    };
    metricsStore.set(name, metric);
    return metric;
  }
  return metricsStore.get(name) as CounterMetric;
}

/**
 * 创建或获取 Gauge 指标
 */
export function createGauge(name: string, help: string): GaugeMetric {
  if (!metricsStore.has(name)) {
    const metric: GaugeMetric = {
      name,
      help,
      type: "gauge",
      values: new Map(),
    };
    metricsStore.set(name, metric);
    return metric;
  }
  return metricsStore.get(name) as GaugeMetric;
}

/**
 * 创建或获取 Histogram 指标
 */
export function createHistogram(name: string, help: string, buckets: number[] = [0.1, 0.5, 1, 2, 5, 10]): HistogramMetric {
  if (!metricsStore.has(name)) {
    const metric: HistogramMetric = {
      name,
      help,
      type: "histogram",
      buckets,
      values: new Map(),
    };
    metricsStore.set(name, metric);
    return metric;
  }
  return metricsStore.get(name) as HistogramMetric;
}

/**
 * 将标签对象转为字符串 key
 */
function labelsToKey(labels?: Record<string, string>): string {
  if (!labels) return "default";
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

/**
 * Counter 增加
 */
export function incCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
  const metric = createCounter(name, "");
  const key = labelsToKey(labels);
  const current = metric.values.get(key) ?? 0;
  metric.values.set(key, current + value);
}

/**
 * Gauge 设置值
 */
export function setGauge(name: string, value: number, labels?: Record<string, string>): void {
  const metric = createGauge(name, "");
  const key = labelsToKey(labels);
  metric.values.set(key, { value, timestamp: Date.now() });
}

/**
 * Gauge 增加
 */
export function incGauge(name: string, value: number = 1, labels?: Record<string, string>): void {
  const metric = createGauge(name, "");
  const key = labelsToKey(labels);
  const current = metric.values.get(key)?.value ?? 0;
  metric.values.set(key, { value: current + value, timestamp: Date.now() });
}

/**
 * Histogram 记录值
 */
export function observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
  const metric = createHistogram(name, "");
  const key = labelsToKey(labels);
  
  let bucketCounts = metric.values.get(key);
  if (!bucketCounts) {
    bucketCounts = new Array(metric.buckets.length + 1).fill(0);
    metric.values.set(key, bucketCounts);
  }
  
  // 找到对应的 bucket 并增加计数
  let bucketIndex = metric.buckets.findIndex((b) => value <= b);
  if (bucketIndex === -1) bucketIndex = metric.buckets.length;
  bucketCounts[bucketIndex]++;
}

/**
 * 导出为 Prometheus 格式
 */
export function exportPrometheusMetrics(): string {
  const lines: string[] = [];
  
  for (const metric of metricsStore.values()) {
    lines.push(`# HELP ${metric.name} ${metric.help}`);
    lines.push(`# TYPE ${metric.name} ${metric.type}`);
    
    if (metric.type === "counter") {
      for (const [key, value] of metric.values) {
        const labels = key === "default" ? "" : `{${key}}`;
        lines.push(`${metric.name}${labels} ${value}`);
      }
    } else if (metric.type === "gauge") {
      for (const [key, data] of metric.values) {
        const labels = key === "default" ? "" : `{${key}}`;
        lines.push(`${metric.name}${labels} ${data.value}`);
      }
    } else if (metric.type === "histogram") {
      for (const [key, counts] of metric.values) {
        const labels = key === "default" ? "" : `,${key}`;
        let cumulative = 0;
        for (let i = 0; i < metric.buckets.length; i++) {
          cumulative += counts[i] ?? 0;
          const bucketLabel = labels ? `{le="${metric.buckets[i]}"${labels}}` : `{le="${metric.buckets[i]}"}`;
          lines.push(`${metric.name}_bucket${bucketLabel} ${cumulative}`);
        }
        // +Inf bucket
        cumulative += counts[metric.buckets.length] ?? 0;
        const infLabel = labels ? `{le="+Inf"${labels}}` : `{le="+Inf"}`;
        lines.push(`${metric.name}_bucket${infLabel} ${cumulative}`);
        lines.push(`${metric.name}_count${labels ? `{${key}}` : ""} ${cumulative}`);
      }
    }
    
    lines.push("");
  }
  
  return lines.join("\n");
}

/**
 * 导出为 JSON 格式（便于调试）
 */
export function exportJSONMetrics(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [name, metric] of metricsStore) {
    if (metric.type === "counter") {
      result[name] = Object.fromEntries(metric.values);
    } else if (metric.type === "gauge") {
      result[name] = Object.fromEntries(
        Array.from(metric.values).map(([k, v]) => [k, v.value])
      );
    } else if (metric.type === "histogram") {
      result[name] = Object.fromEntries(
        Array.from(metric.values).map(([k, v]) => [k, v])
      );
    }
  }
  
  return result;
}

// 预定义的关键指标
export const WORKFLOW_METRICS = {
  // 工作流启动次数
  WORKFLOW_STARTED: "flintstudio_workflow_started_total",
  // 工作流完成次数（按状态）
  WORKFLOW_COMPLETED: "flintstudio_workflow_completed_total",
  // 工作流执行时长
  WORKFLOW_DURATION: "flintstudio_workflow_duration_seconds",
  // 任务执行次数
  TASK_EXECUTED: "flintstudio_task_executed_total",
  // 任务执行时长
  TASK_DURATION: "flintstudio_task_duration_seconds",
  // API 调用次数
  API_CALLS: "flintstudio_api_calls_total",
  // API 调用失败次数
  API_ERRORS: "flintstudio_api_errors_total",
  // API 调用时长
  API_DURATION: "flintstudio_api_duration_seconds",
  // 队列深度
  QUEUE_DEPTH: "flintstudio_queue_depth",
  // LLM Token 使用量
  LLM_TOKENS: "flintstudio_llm_tokens_used",
} as const;

// 初始化指标
createCounter(WORKFLOW_METRICS.WORKFLOW_STARTED, "Total number of workflows started");
createCounter(WORKFLOW_METRICS.WORKFLOW_COMPLETED, "Total number of workflows completed");
createHistogram(WORKFLOW_METRICS.WORKFLOW_DURATION, "Workflow execution duration in seconds", [1, 5, 10, 30, 60, 300, 600]);
createCounter(WORKFLOW_METRICS.TASK_EXECUTED, "Total number of tasks executed");
createHistogram(WORKFLOW_METRICS.TASK_DURATION, "Task execution duration in seconds", [0.1, 0.5, 1, 2, 5, 10, 30, 60]);
createCounter(WORKFLOW_METRICS.API_CALLS, "Total number of API calls");
createCounter(WORKFLOW_METRICS.API_ERRORS, "Total number of API errors");
createHistogram(WORKFLOW_METRICS.API_DURATION, "API call duration in seconds", [0.01, 0.05, 0.1, 0.5, 1, 5, 10]);
createGauge(WORKFLOW_METRICS.QUEUE_DEPTH, "Current queue depth");
