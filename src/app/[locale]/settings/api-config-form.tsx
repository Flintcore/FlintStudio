"use client";

import { useState } from "react";
import type { CustomProvider, ApiType } from "@/lib/api-config";

type TestResult = { success: boolean; message: string; latencyMs: number } | null;

function useTestConnection() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult>(null);

  async function test(type: "llm" | "image" | "tts", baseUrl: string, apiKey: string, model?: string) {
    if (!baseUrl) {
      setResult({ success: false, message: "请先填写 Base URL", latencyMs: 0 });
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, baseUrl, apiKey, model }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ success: false, message: (e as Error).message, latencyMs: 0 });
    } finally {
      setTesting(false);
    }
  }

  return { testing, result, test };
}

const API_TYPE_LABELS: Record<ApiType, string> = {
  llm: "大语言模型",
  image: "图像生成",
  voice: "语音合成",
  video: "视频生成",
};

type Initial = {
  llmBaseUrl: string;
  llmApiKey: string;
  imageBaseUrl: string;
  imageApiKey: string;
  ttsBaseUrl: string;
  ttsApiKey: string;
  videoBaseUrl: string;
  videoApiKey: string;
  analysisModel?: string;
  storyboardModel?: string;
  videoModel?: string;
  /** 数据库中是否已保存 Worker 内部令牌（无明文） */
  hasWorkerInternalToken?: boolean;
  providers?: CustomProvider[];
  defaults?: Partial<Record<ApiType, string>>;
};

const INPUT_CLASS =
  "input-base w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)]";

export function ApiConfigForm({ initial }: { initial: Initial }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState(initial);
  const [providers, setProviders] = useState<CustomProvider[]>(initial.providers ?? []);
  const [defaults, setDefaults] = useState<Partial<Record<ApiType, string>>>(initial.defaults ?? {});
  const [workerTokenInput, setWorkerTokenInput] = useState("");
  const [clearWorkerToken, setClearWorkerToken] = useState(false);
  const llmTest = useTestConnection();
  const imageTest = useTestConnection();
  const ttsTest = useTestConnection();

  function addProvider(type: ApiType = "llm") {
    setProviders((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: "",
        baseUrl: type === "llm" ? "https://openrouter.ai/api/v1" : "",
        apiKey: "",
        model: undefined,
        type,
      },
    ]);
  }

  function updateProvider(id: string, patch: Partial<CustomProvider>) {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  }

  function removeProvider(id: string) {
    setProviders((prev) => prev.filter((p) => p.id !== id));
    setDefaults((prev) => {
      const next = { ...prev };
      (["llm", "image", "voice", "video"] as const).forEach((t) => {
        if (next[t] === id) delete next[t];
      });
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        analysisModel: form.analysisModel || undefined,
        storyboardModel: form.storyboardModel || undefined,
        videoModel: form.videoModel || undefined,
        providers,
        defaults,
      };
      delete payload.hasWorkerInternalToken;
      if (clearWorkerToken) {
        payload.internalTaskToken = null;
      } else if (workerTokenInput.trim()) {
        payload.internalTaskToken = workerTokenInput.trim();
      }

      const res = await fetch("/api/settings/api-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setMsg({ type: "err", text: d.error || "保存失败" });
        return;
      }
      setMsg({ type: "ok", text: "已保存" });
      setWorkerTokenInput("");
      setClearWorkerToken(false);
    } finally {
      setSaving(false);
    }
  }

  const providersByType = (t: ApiType) => providers.filter((p) => p.type === t);

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      {msg && (
        <p
          className={
            msg.type === "ok"
              ? "rounded-xl bg-[var(--success)]/10 px-4 py-3 text-sm text-[var(--success)] animate-fade-in"
              : "rounded-xl bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)] animate-fade-in"
          }
        >
          {msg.text}
        </p>
      )}

      <section className="card-base glass-surface rounded-2xl border border-[var(--border)] p-5">
        <h3 className="font-medium text-[var(--foreground)]">Worker 内部令牌（可选）</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          BullMQ Worker 完成任务后需调用本机 API 推进工作流。若未在服务器环境变量中设置{" "}
          <code className="rounded bg-[var(--muted)]/20 px-1">INTERNAL_TASK_TOKEN</code>
          ，可在此填写同一串随机密钥并保存；需与运行 Next 与 Worker 的进程都能访问的同一数据库一致。
          已设置环境变量时，环境变量优先。
        </p>
        {initial.hasWorkerInternalToken && (
          <p className="mt-2 text-xs text-[var(--success)]">当前已在数据库保存令牌（下方留空表示不修改）</p>
        )}
        <div className="mt-3 space-y-2">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="新的 Worker 内部令牌（留空则不修改）"
            value={workerTokenInput}
            onChange={(e) => setWorkerTokenInput(e.target.value)}
            className={INPUT_CLASS}
          />
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={clearWorkerToken}
              onChange={(e) => setClearWorkerToken(e.target.checked)}
            />
            清除数据库中已保存的令牌（改回仅使用环境变量）
          </label>
        </div>
      </section>

      {/* 多 API / 多模型 */}
      <section className="card-base glass-surface rounded-2xl border border-[var(--border)] p-5">
        <h3 className="font-medium text-[var(--foreground)]">多 API / 多模型</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          添加多个 API 提供商，并为每类能力选择默认使用的提供商；未选时使用下方「单配置」。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["llm", "image", "voice", "video"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addProvider(t)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/20"
            >
              + {API_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        {providers.length > 0 && (
          <div className="mt-4 space-y-3">
            {providers.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/5 p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={p.type}
                    onChange={(e) => updateProvider(p.id, { type: e.target.value as ApiType })}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                  >
                    {(Object.keys(API_TYPE_LABELS) as ApiType[]).map((t) => (
                      <option key={t} value={t}>{API_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeProvider(p.id)}
                    className="text-xs text-[var(--error)] hover:underline"
                  >
                    删除
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="名称（如 OpenRouter、自建）"
                  value={p.name}
                  onChange={(e) => updateProvider(p.id, { name: e.target.value })}
                  className={INPUT_CLASS}
                />
                <input
                  type="url"
                  placeholder="Base URL"
                  value={p.baseUrl}
                  onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })}
                  className={INPUT_CLASS}
                />
                <input
                  type="password"
                  placeholder="API Key"
                  value={p.apiKey}
                  onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
                  className={INPUT_CLASS}
                />
                <input
                  type="text"
                  placeholder="模型 (可选)"
                  value={p.model ?? ""}
                  onChange={(e) => updateProvider(p.id, { model: e.target.value || undefined })}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
            <div className="pt-2 border-t border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--muted)] mb-2">每类默认使用</p>
              <div className="flex flex-wrap gap-4">
                {(["llm", "image", "voice", "video"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--muted)]">{API_TYPE_LABELS[t]}:</span>
                    <select
                      value={defaults[t] ?? ""}
                      onChange={(e) =>
                        setDefaults((d) => ({
                          ...d,
                          [t]: e.target.value || undefined,
                        }))
                      }
                      className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1"
                    >
                      <option value="">使用下方单配置</option>
                      {providersByType(t).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || p.id}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card-base glass-surface rounded-2xl border border-[var(--border)] p-5">
        <h3 className="font-medium text-[var(--foreground)]">单配置（备用）</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">当未选择多 API 默认提供商时使用；也可仅用此处配置。</p>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">大语言模型 · OpenAI 兼容 /v1/chat/completions</p>
            <button type="button" disabled={llmTest.testing} onClick={() => llmTest.test("llm", form.llmBaseUrl, form.llmApiKey, form.analysisModel)} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]/20 disabled:opacity-50">
              {llmTest.testing ? "测试中…" : "测试连接"}
            </button>
          </div>
          {llmTest.result && (
            <p className={`text-xs rounded-lg px-3 py-1.5 ${llmTest.result.success ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--error)]/10 text-[var(--error)]"}`}>
              {llmTest.result.success ? "✓" : "✗"} {llmTest.result.message}{llmTest.result.latencyMs > 0 ? ` · ${llmTest.result.latencyMs}ms` : ""}
            </p>
          )}
          <input type="url" placeholder="Base URL" value={form.llmBaseUrl} onChange={(e) => setForm((f) => ({ ...f, llmBaseUrl: e.target.value }))} className={INPUT_CLASS} />
          <input type="password" placeholder="API Key" value={form.llmApiKey} onChange={(e) => setForm((f) => ({ ...f, llmApiKey: e.target.value }))} className={INPUT_CLASS} />
          <input type="text" placeholder="模型 (可选)" value={form.analysisModel ?? ""} onChange={(e) => setForm((f) => ({ ...f, analysisModel: e.target.value }))} className={INPUT_CLASS} />
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">图像生成 · /v1/images/generations</p>
            <button type="button" disabled={imageTest.testing} onClick={() => imageTest.test("image", form.imageBaseUrl, form.imageApiKey, form.storyboardModel)} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]/20 disabled:opacity-50">
              {imageTest.testing ? "测试中…" : "测试连接"}
            </button>
          </div>
          {imageTest.result && (
            <p className={`text-xs rounded-lg px-3 py-1.5 ${imageTest.result.success ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--error)]/10 text-[var(--error)]"}`}>
              {imageTest.result.success ? "✓" : "✗"} {imageTest.result.message}{imageTest.result.latencyMs > 0 ? ` · ${imageTest.result.latencyMs}ms` : ""}
            </p>
          )}
          <input type="url" placeholder="Base URL" value={form.imageBaseUrl} onChange={(e) => setForm((f) => ({ ...f, imageBaseUrl: e.target.value }))} className={INPUT_CLASS} />
          <input type="password" placeholder="API Key" value={form.imageApiKey} onChange={(e) => setForm((f) => ({ ...f, imageApiKey: e.target.value }))} className={INPUT_CLASS} />
          <input type="text" placeholder="模型 (可选)" value={form.storyboardModel ?? ""} onChange={(e) => setForm((f) => ({ ...f, storyboardModel: e.target.value }))} className={INPUT_CLASS} />
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">语音合成 · /v1/audio/speech</p>
            <button type="button" disabled={ttsTest.testing} onClick={() => ttsTest.test("tts", form.ttsBaseUrl, form.ttsApiKey)} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]/20 disabled:opacity-50">
              {ttsTest.testing ? "测试中…" : "测试连接"}
            </button>
          </div>
          {ttsTest.result && (
            <p className={`text-xs rounded-lg px-3 py-1.5 ${ttsTest.result.success ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--error)]/10 text-[var(--error)]"}`}>
              {ttsTest.result.success ? "✓" : "✗"} {ttsTest.result.message}{ttsTest.result.latencyMs > 0 ? ` · ${ttsTest.result.latencyMs}ms` : ""}
            </p>
          )}
          <input type="url" placeholder="Base URL" value={form.ttsBaseUrl} onChange={(e) => setForm((f) => ({ ...f, ttsBaseUrl: e.target.value }))} className={INPUT_CLASS} />
          <input type="password" placeholder="API Key" value={form.ttsApiKey} onChange={(e) => setForm((f) => ({ ...f, ttsApiKey: e.target.value }))} className={INPUT_CLASS} />
        </div>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--muted)]">视频生成（可选，本版多用 FFmpeg 合成）</p>
          <input type="url" placeholder="Base URL" value={form.videoBaseUrl} onChange={(e) => setForm((f) => ({ ...f, videoBaseUrl: e.target.value }))} className={INPUT_CLASS} />
          <input type="password" placeholder="API Key" value={form.videoApiKey} onChange={(e) => setForm((f) => ({ ...f, videoApiKey: e.target.value }))} className={INPUT_CLASS} />
          <input type="text" placeholder="模型 (可选)" value={form.videoModel ?? ""} onChange={(e) => setForm((f) => ({ ...f, videoModel: e.target.value }))} className={INPUT_CLASS} />
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-[var(--accent)] px-6 py-3 font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-smooth hover-lift animate-scale-in"
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
