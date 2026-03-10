import { prisma } from "@/lib/db";

export type ApiType = "llm" | "image" | "voice" | "video";

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  /** 可选模型名，如 openai/gpt-4o-mini、gpt-4o、dall-e-3、tts-1 */
  model?: string | null;
}

/** 多 API 下的单个提供商（与 waoowaoo 风格一致） */
export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  /** 可选模型，如 gpt-4o-mini、dall-e-3 */
  model?: string | null;
  type: ApiType;
}

/** customProviders 存库结构 */
export interface CustomProvidersPayload {
  providers: CustomProvider[];
  /** 每类默认使用的 provider id */
  defaults?: Partial<Record<ApiType, string>>;
}

function trim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

/** 检查是否为本地端点（不需要 API Key） */
function isLocalEndpoint(baseUrl: string): boolean {
  if (!baseUrl) return false;
  const lower = baseUrl.toLowerCase();
  return lower.includes("localhost") || lower.includes("127.0.0.1");
}

function parseCustomProvidersPayload(raw: string | null | undefined): CustomProvidersPayload {
  if (!raw) return { providers: [], defaults: {} };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { providers: [], defaults: {} };
    const obj = parsed as Record<string, unknown>;
    const providersRaw = Array.isArray(obj.providers) ? obj.providers : [];
    const providers: CustomProvider[] = [];
    const seenIds = new Set<string>();
    for (let i = 0; i < providersRaw.length; i++) {
      const p = providersRaw[i];
      if (!p || typeof p !== "object") continue;
      const o = p as Record<string, unknown>;
      const id = trim(o.id) || `p-${i}-${Date.now()}`;
      const name = trim(o.name) || id;
      const baseUrl = trim(o.baseUrl);
      const apiKey = trim(o.apiKey);
      const type = o.type as string;
      if (!["llm", "image", "voice", "video"].includes(type)) continue;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      providers.push({
        id,
        name,
        baseUrl,
        apiKey,
        model: trim(o.model) || undefined,
        type: type as ApiType,
      });
    }
    const defaults = (obj.defaults && typeof obj.defaults === "object" ? obj.defaults : {}) as Partial<Record<ApiType, string>>;
    return { providers, defaults: defaults || {} };
  } catch {
    return { providers: [], defaults: {} };
  }
}

export async function getCustomProvidersPayload(userId: string): Promise<CustomProvidersPayload> {
  const prefs = await prisma.userPreference.findUnique({
    where: { userId },
    select: { customProviders: true },
  });
  return parseCustomProvidersPayload(prefs?.customProviders ?? undefined);
}

export async function getUserApiConfig(
  userId: string,
  type: ApiType
): Promise<ApiConfig | null> {
  const prefs = await prisma.userPreference.findUnique({
    where: { userId },
  });
  if (!prefs) return null;

  const { providers, defaults } = parseCustomProvidersPayload(prefs.customProviders ?? undefined);
  const defaultId = defaults?.[type];
  if (defaultId && providers.length > 0) {
    const provider = providers.find((p) => p.id === defaultId);
    if (provider && provider.type === type && provider.baseUrl) {
      // 本地端点不需要 API Key
      const apiKeyRequired = !isLocalEndpoint(provider.baseUrl);
      if (!apiKeyRequired || provider.apiKey) {
        return {
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey || "",
          model: provider.model ?? undefined,
        };
      }
    }
  }

  switch (type) {
    case "llm": {
      if (!prefs.llmBaseUrl) return null;
      const apiKeyRequired = !isLocalEndpoint(prefs.llmBaseUrl);
      if (apiKeyRequired && !prefs.llmApiKey) return null;
      return {
        baseUrl: prefs.llmBaseUrl,
        apiKey: prefs.llmApiKey || "",
        model: prefs.analysisModel ?? undefined,
      };
    }
    case "image": {
      if (!prefs.imageBaseUrl) return null;
      const apiKeyRequired = !isLocalEndpoint(prefs.imageBaseUrl);
      if (apiKeyRequired && !prefs.imageApiKey) return null;
      return {
        baseUrl: prefs.imageBaseUrl,
        apiKey: prefs.imageApiKey || "",
        model: prefs.storyboardModel ?? undefined,
      };
    }
    case "voice": {
      if (!prefs.ttsBaseUrl) return null;
      const apiKeyRequired = !isLocalEndpoint(prefs.ttsBaseUrl);
      if (apiKeyRequired && !prefs.ttsApiKey) return null;
      return {
        baseUrl: prefs.ttsBaseUrl,
        apiKey: prefs.ttsApiKey || "",
        model: undefined,
      };
    }
    case "video": {
      if (!prefs.videoBaseUrl) return null;
      const apiKeyRequired = !isLocalEndpoint(prefs.videoBaseUrl);
      if (apiKeyRequired && !prefs.videoApiKey) return null;
      return {
        baseUrl: prefs.videoBaseUrl,
        apiKey: prefs.videoApiKey || "",
        model: prefs.videoModel ?? undefined,
      };
    }
    default:
      return null;
  }
}

export async function setUserApiConfig(
  userId: string,
  type: ApiType,
  config: Partial<ApiConfig>
) {
  await prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      ...toPreferenceFields(type, config),
    },
    update: toPreferenceFields(type, config),
  });
}

/** 保存多 API 配置（providers 列表 + 每类默认选中） */
export async function saveCustomProvidersPayload(
  userId: string,
  payload: CustomProvidersPayload
) {
  const raw =
    payload.providers.length > 0 || (payload.defaults && Object.keys(payload.defaults).length > 0)
      ? JSON.stringify({
          providers: payload.providers,
          defaults: payload.defaults ?? {},
        })
      : null;
  await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, customProviders: raw },
    update: { customProviders: raw },
  });
}

type PreferenceFields = {
  llmBaseUrl?: string;
  llmApiKey?: string;
  imageBaseUrl?: string;
  imageApiKey?: string;
  ttsBaseUrl?: string;
  ttsApiKey?: string;
  videoBaseUrl?: string;
  videoApiKey?: string;
};

function toPreferenceFields(
  type: ApiType,
  config: Partial<ApiConfig>
): PreferenceFields {
  const out: PreferenceFields = {};
  switch (type) {
    case "llm":
      if (config.baseUrl != null) out.llmBaseUrl = config.baseUrl;
      if (config.apiKey != null) out.llmApiKey = config.apiKey;
      break;
    case "image":
      if (config.baseUrl != null) out.imageBaseUrl = config.baseUrl;
      if (config.apiKey != null) out.imageApiKey = config.apiKey;
      break;
    case "voice":
      if (config.baseUrl != null) out.ttsBaseUrl = config.baseUrl;
      if (config.apiKey != null) out.ttsApiKey = config.apiKey;
      break;
    case "video":
      if (config.baseUrl != null) out.videoBaseUrl = config.baseUrl;
      if (config.apiKey != null) out.videoApiKey = config.apiKey;
      break;
  }
  return out;
}
