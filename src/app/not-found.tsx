import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--background)] text-[var(--foreground)] animate-fade-in">
      <h1 className="text-2xl font-semibold">页面不存在</h1>
      <p className="mt-2 text-[var(--muted)]">您访问的地址有误。</p>
      <Link
        href="/zh"
        className="mt-6 rounded-xl bg-[var(--accent)] px-6 py-3 font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-smooth hover-lift"
      >
        返回首页
      </Link>
    </div>
  );
}
