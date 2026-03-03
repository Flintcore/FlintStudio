import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/workspace");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold tracking-tight">
        FlintStudio
      </h1>
      <p className="text-zinc-400 text-center max-w-md">
        AI 影视自动化 · 多 Agent 协同 · 全 API 可配置
      </p>
      <div className="flex gap-4">
        <Link
          href="/auth/signin"
          className="rounded-lg bg-amber-500 px-6 py-2.5 font-medium text-black hover:bg-amber-400"
        >
          登录
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-lg border border-zinc-600 px-6 py-2.5 font-medium hover:bg-zinc-800"
        >
          注册
        </Link>
      </div>
    </div>
  );
}
