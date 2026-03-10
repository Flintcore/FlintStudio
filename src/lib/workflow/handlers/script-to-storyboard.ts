import { prisma } from "@/lib/db";
import { llmJson } from "@/lib/llm/client";
import {
  SCRIPT_TO_STORYBOARD_SYSTEM,
  buildScriptToStoryboardSystemWithStyle,
  buildScriptToStoryboardUserPrompt,
} from "@/lib/workflow/prompts/script-to-storyboard";
import { getSystemPrompt } from "@/lib/workflow/prompts/get-custom-prompt";

export type PanelPerformance = {
  facial?: string;
  body?: string;
  gaze?: string;
  microAction?: string;
};

export type PanelSpec = {
  description?: string;
  imagePrompt?: string;
  location?: string;
  characters?: string[];
  shotType?: string;
  cameraMove?: string;
  performance?: PanelPerformance;
  lighting?: string;
  mood?: string;
};

export type ScriptToStoryboardResult = { panels: PanelSpec[] };

export async function runScriptToStoryboard(opts: {
  userId: string;
  clipId: string;
  clipContent: string;
  visualStyleId?: string | null;
}): Promise<{ panelIds: string[] }> {
  const { userId, clipId, clipContent, visualStyleId } = opts;

  const customPrompt = await getSystemPrompt(userId, "scriptToStoryboardSystem", SCRIPT_TO_STORYBOARD_SYSTEM);
  const systemPrompt = buildScriptToStoryboardSystemWithStyle(customPrompt, visualStyleId);

  const json = await llmJson<ScriptToStoryboardResult>(
    userId,
    systemPrompt,
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
    
    // 构建元数据（包含新增的详细字段）
    const metadata = {
      location: p?.location,
      characters: p?.characters,
      shotType: p?.shotType,
      cameraMove: p?.cameraMove,
      performance: p?.performance,
      lighting: p?.lighting,
      mood: p?.mood,
    };
    
    const created = await prisma.novelPromotionPanel.create({
      data: {
        storyboardId: storyboard.id,
        panelIndex: i,
        description: p?.description ? String(p.description) : null,
        imagePrompt: p?.imagePrompt ? String(p.imagePrompt) : null,
        metadata: JSON.stringify(metadata),
      },
    });
    panelIds.push(created.id);
  }

  return { panelIds };
}
