import { getCurrentSession } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AppHeaderWorkspace } from "../components/app-header";

export default async function WorkspacePage() {
  const session = await getCurrentSession();

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <div className="min-h-screen">
      <AppHeaderWorkspace />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 animate-fade-in">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">
            工作台
          </h2>
          <Link
            href="/api/projects/create"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-smooth hover-lift animate-scale-in"
          >
            + 新建项目
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="card-base glass-surface mt-8 p-12 text-center animate-slide-up animation-delay-100 relative overflow-hidden">
            {/* 装饰性浮动光斑 */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute top-1/4 left-1/4 h-24 w-24 rounded-full bg-[var(--accent)]/10 animate-float" />
              <div className="absolute bottom-1/4 right-1/4 h-20 w-20 rounded-full bg-[var(--accent)]/8 animate-float-delayed" />
            </div>
            <p className="relative text-[var(--muted)]">暂无项目</p>
            <p className="relative mt-2 text-sm text-[var(--muted)]">
              <Link href="/api/projects/create" className="text-[var(--accent)] hover:underline font-medium transition-smooth">
                创建第一个项目
              </Link>
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <li key={p.id} className="animate-slide-up" style={{ animationDelay: `${50 + i * 50}ms` }}>
                <Link
                  href={`/workspace/${p.id}`}
                  className="card-base hover-lift block rounded-2xl border border-[var(--border)] p-5 hover:border-[var(--accent)]/30"
                >
                  <h3 className="font-medium text-[var(--foreground)]">{p.name}</h3>
                  {p.description && (
                    <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
