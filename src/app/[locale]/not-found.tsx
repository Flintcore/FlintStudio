import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 animate-fade-in">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">页面不存在</h1>
      <p className="mt-2 text-[var(--muted)]">您访问的地址有误或已被移除。</p>
      <Link
        href="/workspace"
        className="mt-6 rounded-xl bg-[var(--accent)] px-6 py-3 font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-smooth hover-lift"
      >
        返回工作台
      </Link>
    </div>
  );
}
