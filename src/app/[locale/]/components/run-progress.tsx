"use client";

import { useRunStream } from "@/lib/hooks/use-run-stream";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Wifi,
  WifiOff,
  AlertCircle,
} from "lucide-react";

interface Props {
  runId: string;
  onComplete?: () => void;
  compact?: boolean;
}

export function RunProgress({ runId, onComplete, compact = false }: Props) {
  const { snapshot, connected, error, reconnect } = useRunStream(runId, {
    onComplete: () => onComplete?.(),
  });

  if (!snapshot && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>连接中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={reconnect}
              className="mt-2 text-xs text-red-600 dark:text-red-400 underline"
            >
              重新连接
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
      case "canceled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRunStatusBadge = () => {
    const colorMap: Record<string, string> = {
      running: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
      completed: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300",
      failed: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300",
      canceled: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
      queued: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded ${colorMap[snapshot.status] || colorMap.queued}`}
      >
        {snapshot.status}
      </span>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm">
        {getRunStatusBadge()}
        <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${snapshot.progress.percentage}%` }}
          />
        </div>
        <span className="text-xs text-[var(--muted)]">
          {snapshot.progress.completed}/{snapshot.progress.total}
        </span>
        {connected ? (
          <Wifi className="h-3 w-3 text-green-500" />
        ) : (
          <WifiOff className="h-3 w-3 text-gray-400" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 总进度条 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getRunStatusBadge()}
            <span className="text-sm font-medium">
              {snapshot.currentPhase || "等待中"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            {connected ? (
              <span className="flex items-center gap-1 text-green-600">
                <Wifi className="h-3 w-3" />
                实时
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                离线
              </span>
            )}
          </div>
        </div>

        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              snapshot.status === "failed"
                ? "bg-red-500"
                : snapshot.status === "completed"
                ? "bg-green-500"
                : "bg-[var(--accent)]"
            }`}
            style={{ width: `${snapshot.progress.percentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <span>
            {snapshot.progress.completed} / {snapshot.progress.total} 步骤完成
          </span>
          <span>{snapshot.progress.percentage}%</span>
        </div>
      </div>

      {/* 错误信息 */}
      {snapshot.errorMessage && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3">
          <p className="text-sm text-red-700 dark:text-red-300">
            {snapshot.errorMessage}
          </p>
        </div>
      )}

      {/* 步骤列表 */}
      {snapshot.steps.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
          {snapshot.steps.map((step) => (
            <div
              key={step.stepKey}
              className="flex items-center gap-2 text-sm"
            >
              {getStatusIcon(step.status)}
              <span
                className={`flex-1 ${
                  step.status === "completed"
                    ? "text-[var(--muted)]"
                    : step.status === "running"
                    ? "text-[var(--foreground)] font-medium"
                    : "text-[var(--muted)]"
                }`}
              >
                {step.stepTitle}
              </span>
              {step.status === "running" && step.startedAt && (
                <span className="text-xs text-[var(--muted)]">
                  {Math.round(
                    (Date.now() - new Date(step.startedAt).getTime()) / 1000
                  )}
                  s
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
