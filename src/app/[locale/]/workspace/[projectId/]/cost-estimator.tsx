"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  Clock,
  FileText,
  Image as ImageIcon,
  Mic,
  Film,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-performance";

interface CostEstimate {
  tokens: { input: number; output: number; total: number };
  images: {
    count: number;
    breakdown: { characters: number; locations: number; panels: number };
  };
  voice: { durationSeconds: number; characters: number };
  video: { count: number; durationSeconds: number };
  estimatedCostUSD: {
    llm: number;
    image: number;
    voice: number;
    video: number;
    total: number;
  };
  estimatedTimeMinutes: { min: number; max: number };
}

interface Props {
  novelText: string;
  llmModel?: string;
  imageModel?: string;
  videoModel?: string;
}

export function CostEstimator({
  novelText,
  llmModel,
  imageModel,
  videoModel,
}: Props) {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEstimate = async (text: unknown) => {
    const textStr = String(text);
    if (!textStr || textStr.length < 10) {
      setEstimate(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/workflows/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          novelLength: textStr.length,
          llmModel,
          imageModel,
          videoModel,
        }),
      });
      if (!res.ok) throw new Error("预估失败");
      const data = await res.json();
      setEstimate(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const debouncedFetch = useDebounce(fetchEstimate, 500);

  useEffect(() => {
    debouncedFetch(novelText);
  }, [novelText, llmModel, imageModel, videoModel, debouncedFetch]);

  if (!novelText || novelText.length < 10) {
    return null;
  }

  if (loading && !estimate) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          <span className="ml-2 text-sm text-[var(--muted)]">预估成本中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!estimate) return null;

  const cny = (estimate.estimatedCostUSD.total * 7.2).toFixed(2);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-[var(--accent)]" />
        <h3 className="text-sm font-medium">成本与耗时预估</h3>
        {loading && (
          <Loader2 className="h-3 w-3 animate-spin text-[var(--muted)]" />
        )}
      </div>

      {/* 总览 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-[var(--muted)]">预计成本</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-blue-700 dark:text-blue-300">
            ${estimate.estimatedCostUSD.total}
            <span className="ml-1 text-xs font-normal text-[var(--muted)]">
              (¥{cny})
            </span>
          </p>
        </div>

        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-[var(--muted)]">预计耗时</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-amber-700 dark:text-amber-300">
            {estimate.estimatedTimeMinutes.min}-
            {estimate.estimatedTimeMinutes.max}
            <span className="ml-1 text-xs font-normal text-[var(--muted)]">
              分钟
            </span>
          </p>
        </div>
      </div>

      {/* 详细分解 */}
      <div className="space-y-2 pt-2 border-t border-[var(--border)]">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <FileText className="h-3.5 w-3.5" />
            <span>LLM Tokens</span>
          </div>
          <div className="text-right">
            <span className="font-mono">
              {estimate.tokens.total.toLocaleString()}
            </span>
            <span className="ml-2 text-xs text-[var(--muted)]">
              ${estimate.estimatedCostUSD.llm}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>图像生成</span>
          </div>
          <div className="text-right">
            <span className="font-mono">{estimate.images.count} 张</span>
            <span className="ml-2 text-xs text-[var(--muted)]">
              ${estimate.estimatedCostUSD.image}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <Mic className="h-3.5 w-3.5" />
            <span>语音合成</span>
          </div>
          <div className="text-right">
            <span className="font-mono">{estimate.voice.durationSeconds}s</span>
            <span className="ml-2 text-xs text-[var(--muted)]">
              ${estimate.estimatedCostUSD.voice}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <Film className="h-3.5 w-3.5" />
            <span>视频生成</span>
          </div>
          <div className="text-right">
            <span className="font-mono">
              {estimate.video.count} / {estimate.video.durationSeconds}s
            </span>
            <span className="ml-2 text-xs text-[var(--muted)]">
              ${estimate.estimatedCostUSD.video}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--muted)] pt-1">
        * 实际成本可能因模型、输入复杂度而异，仅供参考
      </p>
    </div>
  );
}
