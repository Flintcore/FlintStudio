/**
 * 页面级加载组件
 * 用于 Next.js App Router 的 loading.tsx
 */

import { LoadingSpinner } from "./loading";

export function PageLoading({ message = "加载中..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center page-content-bg">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-sm text-[var(--muted)]">{message}</p>
    </div>
  );
}

export function SectionLoading({ message = "加载中..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <LoadingSpinner size="md" />
      <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>
    </div>
  );
}

export function InlineLoading({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <div className="inline-flex items-center gap-2">
      <LoadingSpinner size={size} />
      <span className="text-sm text-[var(--muted)]">加载中...</span>
    </div>
  );
}
