import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiConfigForm } from "./api-config-form";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const prefs = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <div className="min-h-screen p-6">
      <header className="mb-8 flex items-center justify-between border-b border-zinc-700 pb-4">
        <Link href="/workspace" className="text-xl font-bold">
          FlintStudio
        </Link>
        <Link href="/workspace" className="text-sm text-zinc-400 hover:text-white">
          返回工作台
        </Link>
      </header>
      <h1 className="mb-6 text-2xl font-semibold">设置中心</h1>
      <p className="mb-6 text-zinc-500">
        所有 AI 服务均需自行配置 API，无厂商锁定。支持 OpenRouter、OpenAI 兼容、自建端点等。
      </p>
      <ApiConfigForm
        userId={session.user.id}
        initial={{
          llmBaseUrl: prefs?.llmBaseUrl ?? "https://openrouter.ai/api/v1",
          llmApiKey: prefs?.llmApiKey ?? "",
          imageBaseUrl: prefs?.imageBaseUrl ?? "",
          imageApiKey: prefs?.imageApiKey ?? "",
          ttsBaseUrl: prefs?.ttsBaseUrl ?? "",
          ttsApiKey: prefs?.ttsApiKey ?? "",
          videoBaseUrl: prefs?.videoBaseUrl ?? "",
          videoApiKey: prefs?.videoApiKey ?? "",
        }}
      />
    </div>
  );
}
