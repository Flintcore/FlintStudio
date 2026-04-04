import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCustomProvidersPayload } from "@/lib/api-config";
import { ApiConfigForm } from "./api-config-form";
import { PromptConfigForm } from "./prompt-config-form";
import { AppHeader } from "../components/app-header";

export default async function SettingsPage() {
  const session = await getCurrentSession();

  const prefs = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });
  const { providers, defaults } = await getCustomProvidersPayload(session.user.id);

  return (
    <div className="min-h-screen page-content-bg">
      <AppHeader backLabel="工作台" backHref="/workspace" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          设置中心
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          大语言模型、图像、语音、视频等 <strong className="text-[var(--foreground)]">AI 接口</strong>{" "}
          均在下方配置并写入数据库，无需在 <code className="text-xs">.env</code> 填写 API Key。部署仅需{" "}
          <code className="text-xs">DATABASE_URL</code>、Redis 等基础设施变量；Worker 内部令牌可在下方填写，也可使用{" "}
          <code className="text-xs">INTERNAL_TASK_TOKEN</code> 环境变量（二选一即可）。
        </p>
        <div className="mt-8 space-y-6">
          <ApiConfigForm
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
              hasWorkerInternalToken: !!(prefs?.internalTaskToken && String(prefs.internalTaskToken).trim()),
              providers,
              defaults: defaults ?? {},
            }}
          />
          <PromptConfigForm />
        </div>
      </main>
    </div>
  );
}
