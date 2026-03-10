import { prisma } from "@/lib/db";
import { llmJson } from "@/lib/llm/client";
import {
  STORY_TO_SCRIPT_SYSTEM,
  buildStoryToScriptUserPrompt,
} from "@/lib/workflow/prompts/story-to-script";
import { getSystemPrompt } from "@/lib/workflow/prompts/get-custom-prompt";

export type StoryToScriptClip = {
  summary: string;
  location: string | null;
  characters: string[];
  content: string;
};

export type StoryToScriptResult = { clips: StoryToScriptClip[] };

export async function runStoryToScript(opts: {
  userId: string;
  episodeId: string;
  episodeContent: string;
  characterNames: string[];
  locationNames: string[];
}): Promise<{ clipIds: string[] }> {
  const { userId, episodeId, episodeContent, characterNames, locationNames } = opts;

  const systemPrompt = await getSystemPrompt(userId, "storyToScriptSystem", STORY_TO_SCRIPT_SYSTEM);
  const json = await llmJson<StoryToScriptResult>(
    userId,
    systemPrompt,
    buildStoryToScriptUserPrompt(episodeContent, characterNames, locationNames),
    { temperature: 0.4 }
  );

  const clips = Array.isArray(json.clips) ? json.clips : [];
  const clipIds: string[] = [];

  await prisma.novelPromotionClip.deleteMany({ where: { episodeId } });

  for (const c of clips) {
    const summary = String(c?.summary ?? "").trim() || "场";
    const location =
      c?.location != null && String(c.location).trim() ? String(c.location).trim() : null;
    const content = String(c?.content ?? "").trim() || "";
    const characters = Array.isArray(c?.characters)
      ? (c.characters as string[]).filter((x) => typeof x === "string")
      : [];
    const created = await prisma.novelPromotionClip.create({
      data: {
        episodeId,
        summary,
        location,
        content,
        characters: characters.length ? JSON.stringify(characters) : null,
      },
    });
    clipIds.push(created.id);
  }

  return { clipIds };
}
