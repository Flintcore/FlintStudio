import { getCurrentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "../components/app-header";
import { SystemHealth } from "./system-health";
import { PerformanceMetrics } from "./performance-metrics";
import { QuickActions } from "./quick-actions";
import { ConfigChecker } from "./config-checker";

export default async function DashboardPage() {
  const session = await getCurrentSession();

  if (!session.user.name) {
    redirect("/workspace");
  }

  return (
    <div className="min-h-screen page-content-bg">
      <AppHeader backLabel="工作台" backHref="/workspace" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          系统仪表盘
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          监控系统健康状态、性能指标和任务队列
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SystemHealth />
            <PerformanceMetrics />
            <ConfigChecker />
          </div>
          <div>
            <QuickActions />
          </div>
        </div>
      </main>
    </div>
  );
}
