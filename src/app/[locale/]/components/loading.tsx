export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-10 w-10",
  };

  return (
    <div
      className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]`}
      role="status"
      aria-label="加载中"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card-base rounded-2xl border border-[var(--border)] p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-[var(--muted)]/20" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-[var(--muted)]/20" />
          <div className="h-3 w-1/2 rounded bg-[var(--muted)]/20" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-[var(--muted)]/20"
          style={{ width: `${Math.random() * 30 + 70}%` }}
        />
      ))}
    </div>
  );
}
