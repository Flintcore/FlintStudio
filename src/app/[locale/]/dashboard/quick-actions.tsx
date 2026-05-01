"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  RefreshCw,
  Settings,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export function QuickActions() {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    if (confirmAction !== action) {
      setConfirmAction(action);
      return;
    }

    setActionLoading(action);
    setConfirmAction(null);

    try {
      switch (action) {
        case "clear-cache":
          await fetch("/api/admin/cache", { method: "POST" });
          break;
        case "clean-queues":
          await fetch("/api/admin/queues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "clean", queue: "all" }),
          });
          break;
      }
    } catch (error) {
      console.error("Action failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const actions = [
    {
      id: "settings",
      label: "系统设置",
      icon: Settings,
      href: "/settings",
      variant: "default",
    },
    {
      id: "clear-cache",
      label: "清理缓存",
      icon: Trash2,
      variant: "danger",
      confirm: true,
    },
    {
      id: "clean-queues",
      label: "清理队列",
      icon: RefreshCw,
      variant: "danger",
      confirm: true,
    },
  ];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">快捷操作</h2>

      <div className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() =>
              action.href
                ? router.push(action.href)
                : handleAction(action.id)
            }
            disabled={!!actionLoading}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
              action.variant === "danger"
                ? "hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600"
                : "hover:bg-[var(--accent)]/5"
            }`}
          >
            {actionLoading === action.id ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <action.icon className="h-5 w-5" />
            )}
            <span className="flex-1">{action.label}</span>
            {action.confirm && confirmAction === action.id && (
              <span className="text-xs bg-red-100 dark:bg-red-950 px-2 py-1 rounded">
                确认?
              </span>
            )}
          </button>
        ))}
      </div>

      {confirmAction && (
        <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              点击同一按钮确认操作。此操作不可撤销。
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
