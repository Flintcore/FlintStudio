import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WorkflowRunForm } from "./workflow-run-form";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");
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
    <div className="min-h-screen p-6">
      <header className="mb-6 flex items-center gap-4 border-b border-zinc-700 pb-4">
        <Link href="/workspace" className="text-zinc-400 hover:text-white">
          ← 工作台
        </Link>
        <h1 className="text-xl font-bold">{project.name}</h1>
      </header>
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/30 p-6">
        <h2 className="mb-4 font-semibold">项目流程</h2>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li>1. 导入小说 / 剧本</li>
          <li>2. 剧本分析（角色、场景、集数）</li>
          <li>3. 角色与场景图生成</li>
          <li>4. 分镜生成</li>
          <li>5. 配音</li>
          <li>6. 视频合成</li>
        </ul>
        <p className="mt-4 text-zinc-500">
          请在「设置」中配置 LLM、图像、语音、视频的 API 后使用。
        </p>
      </div>

      <WorkflowRunForm projectId={projectId} />

      {runs.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-semibold">最近运行</h2>
          <ul className="space-y-1 rounded-lg border border-zinc-700 bg-zinc-900/30 p-3 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">
                  {r.status === "running" && (r.currentPhase ? `进行中 · ${r.currentPhase}` : "进行中")}
                  {r.status === "completed" && "已完成"}
                  {r.status === "failed" && (r.errorMessage || "失败")}
                  {r.status === "queued" && "排队中"}
                </span>
                <span className="text-zinc-500">
                  {new Date(r.queuedAt).toLocaleString("zh-CN")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {episodes.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-semibold">集数</h2>
          <ul className="space-y-1">
            {episodes.map((ep) => (
              <li key={ep.id}>
                <Link
                  href={`/workspace/${projectId}/episode/${ep.id}`}
                  className="text-amber-500 hover:underline"
                >
                  第 {ep.episodeNumber} 集 · {ep.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
