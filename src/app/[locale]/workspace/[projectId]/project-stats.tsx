"use client";

import { useState, useEffect } from "react";
import { Film, Image, Mic, Clock } from "lucide-react";

type Stats = {
  episodeCount: number;
  completedEpisodes: number;
  panelCount: number;
  imagesGenerated: number;
  clipCount: number;
  voiceLineCount: number;
  audioGenerated: number;
  runtimeMs: number | null;
};

function formatRuntime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function ProjectStats({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/stats`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setStats(data);
      })
      .catch(() => {});
  }, [projectId]);

  if (!stats) return null;

  // 只在有数据时显示
  if (stats.episodeCount === 0 && stats.panelCount === 0) return null;

  const cards = [
    {
      icon: <Film className="h-4 w-4" />,
      label: "集数",
      value: stats.completedEpisodes > 0
        ? `${stats.completedEpisodes} / ${stats.episodeCount}`
        : String(stats.episodeCount),
      sub: stats.completedEpisodes > 0 ? "已完成" : "已生成",
    },
    {
      icon: <Image className="h-4 w-4" />,
      label: "分镜图",
      value: stats.imagesGenerated > 0
        ? `${stats.imagesGenerated} / ${stats.panelCount}`
        : String(stats.panelCount),
      sub: stats.imagesGenerated > 0 ? "已出图" : "分镜数",
    },
    {
      icon: <Mic className="h-4 w-4" />,
      label: "配音行",
      value: stats.audioGenerated > 0
        ? `${stats.audioGenerated} / ${stats.voiceLineCount}`
        : String(stats.voiceLineCount),
      sub: stats.audioGenerated > 0 ? "已配音" : "总台词",
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: "总耗时",
      value: stats.runtimeMs != null ? formatRuntime(stats.runtimeMs) : "—",
      sub: "从启动到完成",
    },
  ];

  return (
    <section className="mt-6 animate-fade-in">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="card-base glass-surface rounded-xl border border-[var(--border)] p-4"
          >
            <div className="flex items-center gap-2 text-[var(--accent)] mb-2">
              {c.icon}
              <span className="text-xs text-[var(--muted)]">{c.label}</span>
            </div>
            <p className="text-xl font-semibold text-[var(--foreground)]">{c.value}</p>
            <p className="text-xs text-[var(--muted)]">{c.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
