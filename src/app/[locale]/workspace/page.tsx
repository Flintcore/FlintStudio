import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function WorkspacePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/auth/signin");

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <div className="min-h-screen p-6">
      <header className="mb-8 flex items-center justify-between border-b border-zinc-700 pb-4">
        <Link href="/workspace" className="text-xl font-bold">
          FlintStudio
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/settings"
            className="text-sm text-zinc-400 hover:text-white"
          >
            设置
          </Link>
          <Link
            href="/api/auth/signout"
            className="text-sm text-zinc-400 hover:text-white"
          >
            退出
          </Link>
        </nav>
      </header>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">工作台</h2>
        <Link
          href="/api/projects/create"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400"
        >
          + 新建项目
        </Link>
      </div>
      {projects.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/30 p-12 text-center text-zinc-500">
          <p>暂无项目。点击「新建项目」或</p>
          <p className="mt-2">
            <Link href="/api/projects/create" className="text-amber-500 hover:underline">
              创建第一个项目
            </Link>
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/workspace/${p.id}`}
                className="block rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 transition hover:border-amber-500/50 hover:bg-zinc-800/50"
              >
                <h3 className="font-medium">{p.name}</h3>
                {p.description && (
                  <p className="mt-1 text-sm text-zinc-500 line-clamp-2">
                    {p.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
