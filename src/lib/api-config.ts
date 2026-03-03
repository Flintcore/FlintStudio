import { prisma } from "@/lib/db";

export type ApiType = "llm" | "image" | "voice" | "video";

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

export async function getUserApiConfig(
  userId: string,
  type: ApiType
): Promise<ApiConfig | null> {
  const prefs = await prisma.userPreference.findUnique({
    where: { userId },
  });
  if (!prefs) return null;
  switch (type) {
    case "llm":
      return prefs.llmBaseUrl && prefs.llmApiKey
        ? { baseUrl: prefs.llmBaseUrl, apiKey: prefs.llmApiKey }
        : null;
    case "image":
      return prefs.imageBaseUrl && prefs.imageApiKey
        ? { baseUrl: prefs.imageBaseUrl, apiKey: prefs.imageApiKey }
        : null;
    case "voice":
      return prefs.ttsBaseUrl && prefs.ttsApiKey
        ? { baseUrl: prefs.ttsBaseUrl, apiKey: prefs.ttsApiKey }
        : null;
    case "video":
      return prefs.videoBaseUrl && prefs.videoApiKey
        ? { baseUrl: prefs.videoBaseUrl, apiKey: prefs.videoApiKey }
        : null;
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

function toPreferenceFields(
  type: ApiType,
  config: Partial<ApiConfig>
): Partial<{
  llmBaseUrl: string;
  llmApiKey: string;
  imageBaseUrl: string;
  imageApiKey: string;
  ttsBaseUrl: string;
  ttsApiKey: string;
  videoBaseUrl: string;
  videoApiKey: string;
}> {
  const out: Record<string, string> = {};
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
