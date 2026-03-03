import { prisma } from "@/lib/db";
import { llmJson } from "@/lib/llm/client";
import {
  ANALYZE_NOVEL_SYSTEM,
  buildAnalyzeNovelUserPrompt,
} from "@/lib/workflow/analyze-novel-prompt";

export type AnalyzeNovelResult = {
  characters: Array<{ name: string; description?: string }>;
  locations: Array<{ name: string; summary?: string }>;
  episodes: Array< { episodeNumber: number; name?: string; content: string }>;
};

export async function runAnalyzeNovel(opts: {
  userId: string;
  projectId: string;
  novelPromotionId: string;
  novelText: string;
}): Promise<{ episodeIds: string[] }> {
  const { userId, projectId, novelPromotionId, novelText } = opts;

  const json = await llmJson<AnalyzeNovelResult>(
    userId,
    ANALYZE_NOVEL_SYSTEM,
    buildAnalyzeNovelUserPrompt(novelText),
    { temperature: 0.3 }
  );

  const characters = Array.isArray(json.characters) ? json.characters : [];
  const locations = Array.isArray(json.locations) ? json.locations : [];
  const episodes = Array.isArray(json.episodes) ? json.episodes : [];

  for (const c of characters) {
    const name = String(c?.name ?? "").trim();
    if (!name) continue;
    await prisma.novelPromotionCharacter.create({
      data: {
        novelPromotionProjectId: novelPromotionId,
        name,
        profileData:
          typeof c.description === "string" ? c.description : undefined,
      },
    });
  }

  for (const loc of locations) {
    const name = String(loc?.name ?? "").trim();
    if (!name) continue;
    await prisma.novelPromotionLocation.create({
      data: {
        novelPromotionProjectId: novelPromotionId,
        name,
        summary:
          typeof loc.summary === "string" ? loc.summary : undefined,
      },
    });
  }

  const episodeIds: string[] = [];
  for (const ep of episodes) {
    const num = Number(ep?.episodeNumber) || 1;
    const name = String(ep?.name ?? `第${num}集`).trim();
    const content = String(ep?.content ?? "").trim();
    const created = await prisma.novelPromotionEpisode.create({
      data: {
        novelPromotionProjectId: novelPromotionId,
        episodeNumber: num,
        name,
        novelText: content,
      },
    });
    episodeIds.push(created.id);
  }

  return { episodeIds };
}
