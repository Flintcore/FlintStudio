import { getCurrentSession } from "@/lib/auth";
import Link from "next/link";
import { FolderPlus, FolderOpen } from "lucide-react";
import { prisma } from "@/lib/db";
import { AppHeaderWorkspace } from "../components/app-header";
import { ProjectCard } from "./project-card";

export default async function WorkspacePage() {
  const session = await getCurrentSession();

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <div className="min-h-screen page-content-bg">
      <AppHeaderWorkspace />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 animate-fade-in">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              工作台
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              管理项目，一键从小说生成视频
            </p>
          </div>
          <Link
            href="/api/projects/create"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-smooth hover-lift animate-scale-in shadow-[var(--shadow-sm)]"
          >
            <FolderPlus className="h-4 w-4" />
            + 新建项目
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="card-base glass-surface mt-10 p-12 text-center animate-slide-up animation-delay-100 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute top-1/4 left-1/4 h-24 w-24 rounded-full bg-[var(--accent)]/10 animate-float" />
              <div className="absolute bottom-1/4 right-1/4 h-20 w-20 rounded-full bg-[var(--accent)]/8 animate-float-delayed" />
            </div>
            <FolderOpen className="relative mx-auto h-14 w-14 text-[var(--muted-light)]" strokeWidth={1.2} />
            <p className="relative mt-4 text-[var(--foreground)] font-medium">暂无项目</p>
            <p className="relative mt-1 text-sm text-[var(--muted)]">创建项目后即可开始从小说生成视频</p>
            <Link
              href="/api/projects/create"
              className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-smooth"
            >
              <FolderPlus className="h-4 w-4" />
              创建第一个项目
            </Link>
          </div>
        ) : (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={{ id: p.id, name: p.name, description: p.description }}
                style={{ animationDelay: `${50 + i * 50}ms` }}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
