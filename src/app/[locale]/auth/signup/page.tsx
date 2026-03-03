"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export default function SignUpPage() {
  const t = useTranslations("common");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("两次密码不一致");
      return;
    }
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "注册失败");
      return;
    }
    router.push("/auth/signin");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900/50 p-6 shadow-xl"
      >
        <h1 className="mb-6 text-xl font-semibold">{t("auth.signUp")}</h1>
        {error && (
          <p className="mb-4 rounded bg-red-500/20 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        <label className="mb-2 block text-sm text-zinc-400">{t("auth.username")}</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
          required
        />
        <label className="mb-2 block text-sm text-zinc-400">{t("auth.password")}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
          required
        />
        <label className="mb-2 block text-sm text-zinc-400">{t("auth.confirmPassword")}</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mb-6 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
          required
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-amber-500 py-2.5 font-medium text-black hover:bg-amber-400"
        >
          {t("auth.signUp")}
        </button>
        <p className="mt-4 text-center text-sm text-zinc-500">
          <Link href="/auth/signin" className="text-amber-500 hover:underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </form>
    </div>
  );
}
