"use client";

import { useState } from "react";

type Initial = {
  llmBaseUrl: string;
  llmApiKey: string;
  imageBaseUrl: string;
  imageApiKey: string;
  ttsBaseUrl: string;
  ttsApiKey: string;
  videoBaseUrl: string;
  videoApiKey: string;
};

export function ApiConfigForm({
  userId,
  initial,
}: {
  userId: string;
  initial: Initial;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState(initial);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/api-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setMsg({ type: "err", text: d.error || "保存失败" });
        return;
      }
      setMsg({ type: "ok", text: "已保存" });
    } finally {
      setSaving(false);
    }
  }

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
        <h3 className="font-medium text-[var(--foreground)]">大语言模型 (剧本分析)</h3>
        <div className="mt-3 space-y-3">
          <input
            type="url"
            placeholder="Base URL (如 https://openrouter.ai/api/v1)"
            value={form.llmBaseUrl}
            onChange={(e) => setForm((f) => ({ ...f, llmBaseUrl: e.target.value }))}
            className="input-base w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)]"
          />
          <input
            type="password"
            placeholder="API Key"
            value={form.llmApiKey}
            onChange={(e) => setForm((f) => ({ ...f, llmApiKey: e.target.value }))}
            className="input-base w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)]"
          />
        </div>
      </section>

      <section className="card-base glass-surface rounded-2xl border border-[var(--border)] p-5">
        <h3 className="font-medium text-[var(--foreground)]">图像生成</h3>
        <div className="mt-3 space-y-3">
          <input
            type="url"
            placeholder="Base URL (OpenAI 兼容)"
            value={form.imageBaseUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageBaseUrl: e.target.value }))}
            className="input-base w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)]"
          />
          <input
            type="password"
            placeholder="API Key"
            value={form.imageApiKey}
            onChange={(e) => setForm((f) => ({ ...f, imageApiKey: e.target.value }))}
            className="input-base w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)]"
          />
        </div>
      </section>

      <section className="card-base glass-surface rounded-2xl border border-[var(--border)] p-5">
        <h3 className="font-medium text-[var(--foreground)]">语音合成 (TTS)</h3>
        <div className="mt-3 space-y-3">
          <input
            type="url"
            placeholder="Base URL"
            value={form.ttsBaseUrl}
            onChange={(e) => setForm((f) => ({ ...f, ttsBaseUrl: e.target.value }))}
            className="input-base w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)]"
          />
          <input
            type="password"
            placeholder="API Key"
            value={form.ttsApiKey}
            onChange={(e) => setForm((f) => ({ ...f, ttsApiKey: e.target.value }))}
            className="input-base w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)]"
          />
        </div>
      </section>

      <section className="card-base glass-surface rounded-2xl border border-[var(--border)] p-5">
        <h3 className="font-medium text-[var(--foreground)]">视频生成</h3>
        <div className="mt-3 space-y-3">
          <input
            type="url"
            placeholder="Base URL"
            value={form.videoBaseUrl}
            onChange={(e) => setForm((f) => ({ ...f, videoBaseUrl: e.target.value }))}
            className="input-base w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)]"
          />
          <input
            type="password"
            placeholder="API Key"
            value={form.videoApiKey}
            onChange={(e) => setForm((f) => ({ ...f, videoApiKey: e.target.value }))}
            className="input-base w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)]"
          />
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
