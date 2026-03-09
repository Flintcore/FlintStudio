import { getCurrentSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LayoutList, Film, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { WorkflowRunForm } from "./workflow-run-form";
import { RunList } from "./run-list";
import { AppHeader } from "../../components/app-header";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getCurrentSession();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { novelPromotion: true },
  });
  if (!project) notFound();

  const episodes = project.novelPromotion
    ? await prisma.novelPromotionEpisode.findMany({
        where: { novelPromotionProjectId: project.novelPromotion.id },
        orderBy: { episodeNumber: "asc" },
      })
    : [];

  return (
    <div className="min-h-screen page-content-bg">
      <AppHeader backLabel="工作台" backHref="/workspace" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {project.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">从小说到视频的一键流水线</p>

        <section className="card-base glass-surface mt-8 p-6 animate-slide-up">
          <div className="flex items-center gap-2">
            <LayoutList className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="section-title">项目流程</h2>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-[var(--muted)]">
            <li className="flex items-center gap-2 rounded-lg bg-[var(--background)]/60 px-3 py-2">1. 导入小说 / 剧本</li>
            <li className="flex items-center gap-2 rounded-lg bg-[var(--background)]/60 px-3 py-2">2. 剧本分析（角色、场景、集数）</li>
            <li className="flex items-center gap-2 rounded-lg bg-[var(--background)]/60 px-3 py-2">3. 角色与场景图生成</li>
            <li className="flex items-center gap-2 rounded-lg bg-[var(--background)]/60 px-3 py-2">4. 分镜生成</li>
            <li className="flex items-center gap-2 rounded-lg bg-[var(--background)]/60 px-3 py-2">5. 配音</li>
            <li className="flex items-center gap-2 rounded-lg bg-[var(--background)]/60 px-3 py-2">6. 视频合成</li>
          </ul>
          <p className="mt-4 text-sm text-[var(--muted)]">
            请在「设置」中配置 LLM、图像、语音、视频的 API 后使用。
          </p>
        </section>

        <WorkflowRunForm
          projectId={projectId}
          defaultVisualStyle={project.novelPromotion?.defaultVisualStyle ?? undefined}
        />

        <RunList projectId={projectId} />

        {episodes.length > 0 && (
          <section className="mt-10 animate-slide-up animation-delay-150">
            <div className="flex items-center gap-2 mb-3">
              <Film className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="section-title">集数</h2>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {episodes.map((ep) => (
                <li key={ep.id}>
                  <Link
                    href={`/workspace/${projectId}/episode/${ep.id}`}
                    className="card-base hover-lift flex items-center gap-3 rounded-xl border border-[var(--border)] p-4 text-[var(--foreground)] hover:border-[var(--accent)]/30 transition-smooth"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">第 {ep.episodeNumber} 集</span>
                      {ep.name ? <span className="ml-1 text-sm text-[var(--muted)]">· {ep.name}</span> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
