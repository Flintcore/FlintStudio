import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ projectId: string; episodeId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");
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
      clips: { orderBy: { createdAt: "asc" } },
      storyboards: {
        include: { panels: { orderBy: { panelIndex: "asc" } } },
      },
      voiceLines: { orderBy: { lineIndex: "asc" } },
    },
  });
  if (!episode) notFound();

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6 flex items-center gap-4 border-b border-zinc-700 pb-4">
        <Link
          href={`/workspace/${projectId}`}
          className="text-zinc-400 hover:text-white"
        >
          ← 项目
        </Link>
        <h1 className="text-xl font-bold">
          第 {episode.episodeNumber} 集 · {episode.name}
        </h1>
      </header>

      {episode.clips.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold">分场</h2>
          <ul className="space-y-3">
            {episode.clips.map((clip) => (
              <li
                key={clip.id}
                className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4"
              >
                <p className="font-medium text-amber-400">{clip.summary}</p>
                {clip.location && (
                  <p className="text-sm text-zinc-500">场景: {clip.location}</p>
                )}
                <p className="mt-2 text-sm text-zinc-400 line-clamp-3">
                  {clip.content}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {episode.storyboards.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold">分镜与出图</h2>
          <div className="space-y-6">
            {episode.storyboards.map((sb) => (
              <div key={sb.id} className="rounded-lg border border-zinc-700 bg-zinc-900/30 p-4">
                <p className="mb-3 text-sm text-zinc-500">
                  共 {sb.panelCount} 镜
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sb.panels.map((panel) => (
                    <div
                      key={panel.id}
                      className="overflow-hidden rounded-lg border border-zinc-600"
                    >
                      {panel.imageUrl ? (
                        <img
                          src={panel.imageUrl}
                          alt={panel.description ?? ""}
                          className="h-48 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-48 items-center justify-center bg-zinc-800 text-zinc-500">
                          待出图
                        </div>
                      )}
                      <div className="p-2 text-xs text-zinc-400">
                        {panel.description ?? panel.imagePrompt ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {episode.voiceLines.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold">配音</h2>
          <ul className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-900/30 p-4">
            {episode.voiceLines.map((vl, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="text-amber-400">{vl.speaker}</span>
                <span className="text-zinc-400">{vl.content}</span>
                {vl.audioUrl && (
                  <audio controls src={vl.audioUrl} className="h-8 max-w-xs" />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {episode.videoUrl && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold">成片</h2>
          <video
            className="max-h-[70vh] w-full rounded-lg border border-zinc-700 bg-black"
            controls
            src={episode.videoUrl}
            playsInline
          />
        </section>
      )}

      {episode.clips.length === 0 && episode.storyboards.length === 0 && !episode.videoUrl && (
        <p className="text-zinc-500">
          暂无分场与分镜数据，请在工作流中完成「剧本分析 → 分场 → 分镜」后刷新。
        </p>
      )}
    </div>
  );
}
