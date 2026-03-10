import { prisma } from "@/lib/db";
import { llmJson } from "@/lib/llm/client";
import {
  VOICE_EXTRACT_SYSTEM,
  buildVoiceExtractUserPrompt,
} from "@/lib/workflow/prompts/voice-extract";
import { getSystemPrompt } from "@/lib/workflow/prompts/get-custom-prompt";

export type VoiceLineSpec = { 
  speaker: string; 
  content: string;
  type?: string;
  emotion?: string;
  tone?: string;
  audioNote?: string;
};
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
    
    // 提取类型：从 speaker 判断
    let lineType = "对白";
    if (speaker.includes("内心") || speaker.includes("心想")) {
      lineType = "内心独白";
    } else if (speaker === "旁白" || speaker === "Narrator") {
      lineType = "旁白";
    } else if (speaker.includes("众") || speaker.includes("群")) {
      lineType = "群声";
    }
    
    const created = await prisma.novelPromotionVoiceLine.create({
      data: {
        episodeId,
        lineIndex: i,
        speaker,
        content,
        lineType,
        emotion: l?.emotion ? String(l.emotion) : null,
        tone: l?.tone ? String(l.tone) : null,
        audioNote: l?.audioNote ? String(l.audioNote) : null,
      },
    });
    lineIds.push(created.id);
  }

  return { lineIds };
}
