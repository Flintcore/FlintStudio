"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Settings,
  Loader2,
} from "lucide-react";

interface ConfigCheck {
  name: string;
  value: string | undefined;
  required: boolean;
  status: "ok" | "warning" | "error";
  message: string;
  suggestion?: string;
}

interface ConfigCheckResult {
  status: "ok" | "warning" | "error";
  checks: ConfigCheck[];
  summary: {
    total: number;
    ok: number;
    warnings: number;
    errors: number;
  };
}

export function ConfigChecker() {
  const [result, setResult] = useState<ConfigCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config-check");
      if (!res.ok) throw new Error("配置检查失败");
      const data = await res.json();
      setResult(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheck();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "ok":
        return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900";
      case "warning":
        return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900";
      case "error":
        return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900";
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">环境配置检查</h2>
        </div>
        <button
          onClick={fetchCheck}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-[var(--accent)]/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* 摘要 */}
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="rounded-lg bg-[var(--background)] p-3 text-center">
              <div className="text-2xl font-semibold">{result.summary.total}</div>
              <div className="text-xs text-[var(--muted)]">总计</div>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center">
              <div className="text-2xl font-semibold text-green-600">
                {result.summary.ok}
              </div>
              <div className="text-xs text-[var(--muted)]">正常</div>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
              <div className="text-2xl font-semibold text-amber-600">
                {result.summary.warnings}
              </div>
              <div className="text-xs text-[var(--muted)]">警告</div>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
              <div className="text-2xl font-semibold text-red-600">
                {result.summary.errors}
              </div>
              <div className="text-xs text-[var(--muted)]">错误</div>
            </div>
          </div>

          {/* 检查项列表 */}
          <div className="mt-6 space-y-3">
            {result.checks.map((check) => (
              <div
                key={check.name}
                className={`p-4 rounded-xl border ${getStatusBg(check.status)}`}
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(check.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium font-mono text-sm">
                        {check.name}
                      </span>
                      {check.required && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          必需
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm">{check.message}</p>
                    {check.value !== undefined && (
                      <p className="mt-1 text-xs text-[var(--muted)] font-mono break-all">
                        当前值: {check.value}
                      </p>
                    )}
                    {check.suggestion && check.status !== "ok" && (
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        💡 {check.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
