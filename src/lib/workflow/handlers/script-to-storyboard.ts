import { prisma } from "@/lib/db";
import { llmJson } from "@/lib/llm/client";
import {
  SCRIPT_TO_STORYBOARD_SYSTEM,
  buildScriptToStoryboardUserPrompt,
} from "@/lib/workflow/prompts/script-to-storyboard";

export type PanelSpec = {
  description?: string;
  imagePrompt?: string;
  location?: string;
  characters?: string[];
};

export type ScriptToStoryboardResult = { panels: PanelSpec[] };

export async function runScriptToStoryboard(opts: {
  userId: string;
  clipId: string;
  clipContent: string;
}): Promise<{ panelIds: string[] }> {
  const { userId, clipId, clipContent } = opts;

  const json = await llmJson<ScriptToStoryboardResult>(
    userId,
    SCRIPT_TO_STORYBOARD_SYSTEM,
    buildScriptToStoryboardUserPrompt(clipContent),
    { temperature: 0.3 }
  );

  const panels = Array.isArray(json.panels) ? json.panels : [];
  const panelIds: string[] = [];

  const clip = await prisma.novelPromotionClip.findUnique({
    where: { id: clipId },
    select: { episodeId: true },
  });
  if (!clip) throw new Error("Clip not found");

  await prisma.novelPromotionStoryboard.deleteMany({ where: { clipId } });

  const storyboard = await prisma.novelPromotionStoryboard.create({
    data: {
      episodeId: clip.episodeId,
      clipId,
      panelCount: panels.length,
    },
  });

  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    const created = await prisma.novelPromotionPanel.create({
      data: {
        storyboardId: storyboard.id,
        panelIndex: i,
        description: p?.description ? String(p.description) : null,
        imagePrompt: p?.imagePrompt ? String(p.imagePrompt) : null,
        location: p?.location ? String(p.location) : null,
        characters: Array.isArray(p?.characters) ? JSON.stringify(p.characters) : null,
      },
    });
    panelIds.push(created.id);
  }

  return { panelIds };
}
