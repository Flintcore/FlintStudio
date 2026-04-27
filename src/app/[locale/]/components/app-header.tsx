"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { GlobalSearch } from "./global-search";

const brand = "FlintStudio";

export function AppHeader({
  backLabel,
  backHref,
  right,
}: {
  backLabel?: string;
  backHref?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 glass-nav animate-fade-in">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/workspace"
            className="text-lg font-semibold tracking-tight text-[var(--foreground)] hover:text-[var(--accent)] transition-smooth"
          >
            {brand}
          </Link>
          {backHref && backLabel && (
            <Link
              href={backHref}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-smooth"
            >
              ← {backLabel}
            </Link>
          )}
        </div>
        {right && <nav className="flex items-center gap-3">{right}</nav>}
      </div>
    </header>
  );
}

export function AppHeaderWorkspace() {
  return (
    <AppHeader
      right={
        <div className="flex items-center gap-2">
          <GlobalSearch />
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-muted)] transition-smooth"
          >
            <Settings className="h-4 w-4" />
            设置
          </Link>
        </div>
      }
    />
  );
}
