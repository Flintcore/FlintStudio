import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCustomProvidersPayload } from "@/lib/api-config";
import { ApiConfigForm } from "./api-config-form";
import { AppHeader } from "../components/app-header";

export default async function SettingsPage() {
  const session = await getCurrentSession();

  const prefs = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });
  const { providers, defaults } = await getCustomProvidersPayload(session.user.id);

  return (
    <div className="min-h-screen">
      <AppHeader backLabel="工作台" backHref="/workspace" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 animate-fade-in">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          设置中心
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          所有 AI 服务均需自行配置 API，无厂商锁定。支持多 API、多模型接入，可添加多个提供商并选择默认。
        </p>
        <div className="mt-8">
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
              analysisModel: prefs?.analysisModel ?? "",
              storyboardModel: prefs?.storyboardModel ?? "",
              videoModel: prefs?.videoModel ?? "",
              providers,
              defaults: defaults ?? {},
            }}
          />
        </div>
      </main>
    </div>
  );
}
