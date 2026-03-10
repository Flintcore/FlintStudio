import { prisma } from "@/lib/db";
import { llmJson } from "@/lib/llm/client";
import {
  VOICE_EXTRACT_SYSTEM,
  buildVoiceExtractUserPrompt,
} from "@/lib/workflow/prompts/voice-extract";
import { getSystemPrompt } from "@/lib/workflow/prompts/get-custom-prompt";

export type VoiceLineSpec = { speaker: string; content: string };
export type VoiceExtractResult = { lines: VoiceLineSpec[] };

export async function runVoiceExtract(opts: {
  userId: string;
  episodeId: string;
  clipsContent: string[];
}): Promise<{ lineIds: string[] }> {
  const { userId, episodeId, clipsContent } = opts;
  if (clipsContent.length === 0) return { lineIds: [] };

  const systemPrompt = await getSystemPrompt(userId, "voiceExtractSystem", VOICE_EXTRACT_SYSTEM);
  const json = await llmJson<VoiceExtractResult>(
    userId,
    systemPrompt,
    buildVoiceExtractUserPrompt(clipsContent),
    { temperature: 0.2 }
  );

  const lines = Array.isArray(json.lines) ? json.lines : [];
  const lineIds: string[] = [];

  await prisma.novelPromotionVoiceLine.deleteMany({ where: { episodeId } });

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const speaker = String(l?.speaker ?? "旁白").trim() || "旁白";
    const content = String(l?.content ?? "").trim();
    if (!content) continue;
    const created = await prisma.novelPromotionVoiceLine.create({
      data: {
        episodeId,
        lineIndex: i,
        speaker,
        content,
      },
    });
    lineIds.push(created.id);
  }

  return { lineIds };
}
