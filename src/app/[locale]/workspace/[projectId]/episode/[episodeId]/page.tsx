import { getCurrentSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AppHeader } from "../../../../components/app-header";
import { EpisodeVideoPlayer } from "./episode-video-player";
import { PanelGrid } from "./panel-grid";

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ projectId: string; episodeId: string }>;
}) {
  const session = await getCurrentSession();
  const { projectId, episodeId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { novelPromotion: true },
  });
  if (!project?.novelPromotion) notFound();

  const episode = await prisma.novelPromotionEpisode.findFirst({
    where: {
      id: episodeId,
      novelPromotionProjectId: project.novelPromotion.id,
    },
    include: {
      clips: true,
      storyboards: {
        include: { panels: { orderBy: { panelIndex: "asc" } } },
      },
      voiceLines: { orderBy: { lineIndex: "asc" } },
    },
  });
  if (!episode) notFound();

  return (
    <div className="min-h-screen">
      <AppHeader
        backLabel="项目"
        backHref={`/workspace/${projectId}`}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 animate-fade-in">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          第 {episode.episodeNumber} 集 · {episode.name}
        </h1>

        {episode.clips.length > 0 && (
          <section className="mt-8 animate-slide-up animation-delay-100">
            <h2 className="font-medium text-[var(--foreground)]">分场</h2>
            <ul className="mt-3 space-y-3">
              {episode.clips.map((clip) => (
                <li
                  key={clip.id}
                  className="card-base glass-surface rounded-2xl border border-[var(--border)] p-4 hover:shadow-[var(--shadow)]"
                >
                  <p className="font-medium text-[var(--accent)]">{clip.summary}</p>
                  {clip.location && (
                    <p className="mt-1 text-sm text-[var(--muted)]">场景: {clip.location}</p>
                  )}
                  <p className="mt-2 text-sm text-[var(--muted)] line-clamp-3">
                    {clip.content}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {episode.storyboards.length > 0 && (
          <section className="mt-8 animate-slide-up animation-delay-150">
            <h2 className="font-medium text-[var(--foreground)]">分镜与出图</h2>
            <div className="mt-3 space-y-6">
              {episode.storyboards.map((sb) => (
                <div key={sb.id} className="card-base glass-surface rounded-2xl border border-[var(--border)] p-4 hover:shadow-[var(--shadow)]">
                  <p className="mb-3 text-sm text-[var(--muted)]">
                    共 {sb.panelCount} 镜
                  </p>
                  <PanelGrid panels={sb.panels.map((p) => ({
                    id: p.id,
                    imageUrl: p.imageUrl,
                    description: p.description,
                    imagePrompt: p.imagePrompt,
                  }))} />
                </div>
              ))}
            </div>
          </section>
        )}

        {episode.voiceLines.length > 0 && (
          <section className="mt-8 animate-slide-up animation-delay-200">
            <h2 className="font-medium text-[var(--foreground)]">配音</h2>
            <ul className="card-base mt-3 space-y-2 rounded-2xl border border-[var(--border)] p-4">
              {episode.voiceLines.map((vl, i) => (
                <li key={i} className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-[var(--accent)]">{vl.speaker}</span>
                  <span className="text-[var(--muted)]">{vl.content}</span>
                  {vl.audioUrl && (
                    <audio controls src={vl.audioUrl} className="h-8 max-w-xs rounded-lg" />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8 animate-slide-up animation-delay-250">
          <h2 className="font-medium text-[var(--foreground)]">成片</h2>
          <EpisodeVideoPlayer episodeId={episodeId} initialVideoUrl={episode.videoUrl ?? null} />
        </section>

        {episode.clips.length === 0 && episode.storyboards.length === 0 && (
          <p className="mt-8 text-[var(--muted)]">
            暂无分场与分镜数据，请在工作流中完成「剧本分析 → 分场 → 分镜」后刷新。
          </p>
        )}
      </main>
    </div>
  );
}
