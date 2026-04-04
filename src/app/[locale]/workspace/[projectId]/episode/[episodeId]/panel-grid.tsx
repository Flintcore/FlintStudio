"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

type Panel = {
  id: string;
  imageUrl: string | null;
  description: string | null;
  imagePrompt: string | null;
};

function PanelCard({ panel }: { panel: Panel }) {
  const [imageUrl, setImageUrl] = useState<string | null>(panel.imageUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/panels/${panel.id}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "重新生成失败");
        return;
      }
      setImageUrl(data.imageUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] transition-smooth hover:border-[var(--accent)]/30 hover:shadow-[var(--shadow-sm)]">
      <div className="relative group">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={panel.description ?? ""}
            className="h-48 w-full object-cover"
          />
        ) : (
          <div className="flex h-48 items-center justify-center bg-[var(--background)] text-[var(--muted)]">
            {loading ? (
              <span className="animate-pulse text-[var(--accent)]">生成中…</span>
            ) : (
              "待出图"
            )}
          </div>
        )}
        {/* 重新生成按钮 — hover 显示 */}
        <button
          type="button"
          onClick={regenerate}
          disabled={loading}
          title="重新生成"
          className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40 hover:bg-black/80"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "生成中" : "重新生成"}
        </button>
      </div>
      <div className="p-3 text-xs text-[var(--muted)]">
        {panel.description ?? panel.imagePrompt ?? "—"}
      </div>
      {error && (
        <p className="px-3 pb-2 text-xs text-[var(--error)]">{error}</p>
      )}
    </div>
  );
}

export function PanelGrid({ panels }: { panels: Panel[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {panels.map((panel) => (
        <PanelCard key={panel.id} panel={panel} />
      ))}
    </div>
  );
}
