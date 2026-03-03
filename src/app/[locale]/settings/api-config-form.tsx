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
              ? "rounded bg-emerald-500/20 px-3 py-2 text-sm text-emerald-400"
              : "rounded bg-red-500/20 px-3 py-2 text-sm text-red-400"
          }
        >
          {msg.text}
        </p>
      )}

      <section className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
        <h3 className="mb-3 font-medium">大语言模型 (剧本分析)</h3>
        <div className="space-y-2">
          <input
            type="url"
            placeholder="Base URL (如 https://openrouter.ai/api/v1)"
            value={form.llmBaseUrl}
            onChange={(e) => setForm((f) => ({ ...f, llmBaseUrl: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="API Key"
            value={form.llmApiKey}
            onChange={(e) => setForm((f) => ({ ...f, llmApiKey: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
        <h3 className="mb-3 font-medium">图像生成</h3>
        <div className="space-y-2">
          <input
            type="url"
            placeholder="Base URL (OpenAI 兼容)"
            value={form.imageBaseUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageBaseUrl: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="API Key"
            value={form.imageApiKey}
            onChange={(e) => setForm((f) => ({ ...f, imageApiKey: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
        <h3 className="mb-3 font-medium">语音合成 (TTS)</h3>
        <div className="space-y-2">
          <input
            type="url"
            placeholder="Base URL"
            value={form.ttsBaseUrl}
            onChange={(e) => setForm((f) => ({ ...f, ttsBaseUrl: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="API Key"
            value={form.ttsApiKey}
            onChange={(e) => setForm((f) => ({ ...f, ttsApiKey: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
        <h3 className="mb-3 font-medium">视频生成</h3>
        <div className="space-y-2">
          <input
            type="url"
            placeholder="Base URL"
            value={form.videoBaseUrl}
            onChange={(e) => setForm((f) => ({ ...f, videoBaseUrl: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="API Key"
            value={form.videoApiKey}
            onChange={(e) => setForm((f) => ({ ...f, videoApiKey: e.target.value }))}
            className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-amber-500 px-6 py-2.5 font-medium text-black hover:bg-amber-400 disabled:opacity-50"
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
