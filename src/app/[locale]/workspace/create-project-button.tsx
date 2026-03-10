"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";

export function CreateProjectButton({
  variant = "primary",
}: {
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "创建失败");
        return;
      }
      const data = await res.json();
      router.push(`/workspace/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  const baseClass =
    "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-smooth disabled:opacity-50 disabled:cursor-not-allowed";
  const variantClass =
    variant === "primary"
      ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] hover-lift animate-scale-in shadow-[var(--shadow-sm)]"
      : "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]";

  return (
    <button
      onClick={handleCreate}
      disabled={creating}
      className={`${baseClass} ${variantClass}`}
    >
      <FolderPlus className="h-4 w-4" />
      {creating ? "创建中…" : variant === "primary" ? "+ 新建项目" : "创建第一个项目"}
    </button>
  );
}
