import { prisma } from "@/lib/db";
import { llmJson } from "@/lib/llm/client";
import {
  ANALYZE_NOVEL_SYSTEM,
  buildAnalyzeNovelUserPrompt,
} from "@/lib/workflow/prompts/analyze-novel";
import { getSystemPrompt } from "@/lib/workflow/prompts/get-custom-prompt";

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

  const systemPrompt = await getSystemPrompt(userId, "analyzeNovelSystem", ANALYZE_NOVEL_SYSTEM);
  const json = await llmJson<AnalyzeNovelResult>(
    userId,
    systemPrompt,
    buildAnalyzeNovelUserPrompt(novelText),
    { temperature: 0.3 }
  );

  const characters = Array.isArray(json.characters) ? json.characters : [];
  const locations = Array.isArray(json.locations) ? json.locations : [];
  const episodes = Array.isArray(json.episodes) ? json.episodes : [];

  const episodeIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];

    for (const c of characters) {
      const name = String(c?.name ?? "").trim();
      if (!name) continue;
      await tx.novelPromotionCharacter.create({
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
      await tx.novelPromotionLocation.create({
        data: {
          novelPromotionProjectId: novelPromotionId,
          name,
          summary:
            typeof loc.summary === "string" ? loc.summary : undefined,
        },
      });
    }

    // 获取当前已有剧集的最大编号，避免冲突
    const lastEpisode = await tx.novelPromotionEpisode.findFirst({
      where: { novelPromotionProjectId: novelPromotionId },
      orderBy: { episodeNumber: "desc" },
      select: { episodeNumber: true },
    });
    const baseEpisodeNumber = (lastEpisode?.episodeNumber ?? 0);

    for (const ep of episodes) {
      const aiEpisodeNum = Number(ep?.episodeNumber) || 1;
      const num = baseEpisodeNumber + aiEpisodeNum;
      const name = String(ep?.name ?? `第${aiEpisodeNum}集`).trim();
      const content = String(ep?.content ?? "").trim();

      try {
        const created = await tx.novelPromotionEpisode.create({
          data: {
            novelPromotionProjectId: novelPromotionId,
            episodeNumber: num,
            name,
            novelText: content,
          },
        });
        ids.push(created.id);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Unique constraint")) {
          const fallbackNum = baseEpisodeNumber + ids.length + 1;
          const fallbackCreated = await tx.novelPromotionEpisode.create({
            data: {
              novelPromotionProjectId: novelPromotionId,
              episodeNumber: fallbackNum,
              name: `${name} (重编号)`,
              novelText: content,
            },
          });
          ids.push(fallbackCreated.id);
        } else {
          throw error;
        }
      }
    }

    return ids;
  });

  return { episodeIds };
}
