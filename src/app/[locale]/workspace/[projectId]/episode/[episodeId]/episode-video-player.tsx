"use client";

import { useState, useEffect, useRef } from "react";

export function EpisodeVideoPlayer({
  episodeId,
  initialVideoUrl,
}: {
  episodeId: string;
  initialVideoUrl: string | null;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 如果已有视频，不需要轮询
    if (videoUrl) return;

    // 轮询直到视频生成
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/episodes/${episodeId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.videoUrl) {
          setVideoUrl(data.videoUrl);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [episodeId, videoUrl]);

  if (videoUrl) {
    return (
      <video
        className="mt-3 max-h-[70vh] w-full rounded-2xl border border-[var(--border)] bg-black"
        controls
        src={videoUrl}
        playsInline
      />
    );
  }

  return (
    <div className="mt-3 flex h-48 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--background)]/60">
      <div className="text-center text-sm text-[var(--muted)]">
        <div className="mb-2 animate-pulse">⏳</div>
        <p>视频合成中，完成后自动显示…</p>
      </div>
    </div>
  );
}
