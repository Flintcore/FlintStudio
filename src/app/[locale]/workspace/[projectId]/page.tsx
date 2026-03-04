import { getCurrentSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { WorkflowRunForm } from "./workflow-run-form";
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

  const [episodes, runs] = await Promise.all([
    project.novelPromotion
      ? prisma.novelPromotionEpisode.findMany({
          where: { novelPromotionProjectId: project.novelPromotion.id },
          orderBy: { episodeNumber: "asc" },
        })
      : [],
    prisma.graphRun.findMany({
      where: { projectId, userId: session.user.id },
      orderBy: { queuedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        currentPhase: true,
        errorMessage: true,
        queuedAt: true,
        finishedAt: true,
      },
    }),
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader backLabel="工作台" backHref="/workspace" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 animate-fade-in">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          {project.name}
        </h1>

        <section className="card-base glass-surface mt-6 p-6 animate-slide-up">
          <h2 className="font-medium text-[var(--foreground)]">项目流程</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-[var(--muted)]">
            <li>1. 导入小说 / 剧本</li>
            <li>2. 剧本分析（角色、场景、集数）</li>
            <li>3. 角色与场景图生成</li>
            <li>4. 分镜生成</li>
            <li>5. 配音</li>
            <li>6. 视频合成</li>
          </ul>
          <p className="mt-4 text-sm text-[var(--muted)]">
            请在「设置」中配置 LLM、图像、语音、视频的 API 后使用。
          </p>
        </section>

        <WorkflowRunForm projectId={projectId} />

        {runs.length > 0 && (
          <section className="mt-8 animate-slide-up animation-delay-100">
            <h2 className="font-medium text-[var(--foreground)]">最近运行</h2>
            <ul className="card-base mt-3 space-y-2 rounded-2xl border border-[var(--border)] p-4">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-[var(--muted)]">
                    {r.status === "running" && (r.currentPhase ? `进行中 · ${r.currentPhase}` : "进行中")}
                    {r.status === "completed" && "已完成"}
                    {r.status === "failed" && (r.errorMessage || "失败")}
                    {r.status === "queued" && "排队中"}
                  </span>
                  <span className="text-[var(--muted-light)]">
                    {new Date(r.queuedAt).toLocaleString("zh-CN")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {episodes.length > 0 && (
          <section className="mt-8 animate-slide-up animation-delay-150">
            <h2 className="font-medium text-[var(--foreground)]">集数</h2>
            <ul className="mt-3 space-y-2">
              {episodes.map((ep) => (
                <li key={ep.id}>
                  <Link
                    href={`/workspace/${projectId}/episode/${ep.id}`}
                    className="text-[var(--accent)] hover:underline font-medium transition-smooth"
                  >
                    第 {ep.episodeNumber} 集 · {ep.name}
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
