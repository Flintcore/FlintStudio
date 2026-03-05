"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderOpen, ChevronRight, Trash2 } from "lucide-react";

type Project = { id: string; name: string; description: string | null };

export function ProjectCard({
  project,
  style,
}: {
  project: Project;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "删除失败");
        return;
      }
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <li className="animate-slide-up group relative" style={style}>
      <Link
        href={`/workspace/${project.id}`}
        className="card-base hover-lift block rounded-2xl border border-[var(--border)] p-5 hover:border-[var(--accent)]/30 pr-12"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[var(--foreground)]">{project.name}</h3>
            {project.description ? (
              <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                {project.description}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted-light)]">点击进入</p>
            )}
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-[var(--muted-light)] group-hover:text-[var(--accent)] transition-colors" />
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setConfirmOpen(true);
        }}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--muted)]/15 hover:text-[var(--error)] transition-colors"
        title="删除项目"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {confirmOpen && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[var(--background)]/95 p-4"
          role="dialog"
          aria-label="确认删除"
        >
          <div className="text-center">
            <p className="text-sm text-[var(--foreground)]">确定删除「{project.name}」？</p>
            <p className="mt-1 text-xs text-[var(--muted)]">剧集、分镜、运行记录等将一并删除</p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-[var(--error)] px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "删除中…" : "确定删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
