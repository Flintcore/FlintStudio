// beta0.55: 一致性控制与降级处理模块
import { prisma } from "@/lib/db";
import { generateImage } from "@/lib/generators/image-client";

// ==================== 一致性控制 ====================
export interface ConsistencyContext {
  characters: {
    id: string;
    name: string;
    seed: number;
    referenceImage?: string;
    description: string;
  }[];
  scenes: {
    id: string;
    location: string;
    lighting: string;
    referenceImage?: string;
  }[];
}

export async function getConsistencyContext(projectId: string): Promise<ConsistencyContext> {
  const project = await prisma.novelPromotionProject.findUnique({
    where: { id: projectId },
    include: {
      characters: true,
      locations: true,
    },
  });

  if (!project) {
    return { characters: [], scenes: [] };
  }

  return {
    characters: project.characters.map((char, index) => ({
      id: char.id,
      name: char.name,
      seed: 1000000 + index * 1000, // 基于索引生成固定seed
      description: `${char.name}, ${char.appearance || 'unspecified appearance'}`,
    })),
    scenes: project.locations.map((loc, index) => ({
      id: loc.id,
      location: loc.name,
      lighting: loc.description || 'natural lighting',
    })),
  };
}

export function enhancePromptWithConsistency(
  basePrompt: string,
  characterId: string | undefined,
  sceneId: string | undefined,
  context: ConsistencyContext
): string {
  let enhanced = basePrompt;

  // 添加角色一致性
  if (characterId) {
    const character = context.characters.find(c => c.id === characterId);
    if (character) {
      enhanced = `${enhanced}, featuring ${character.description}, consistent appearance`;
    }
  }

  // 添加场景一致性
  if (sceneId) {
    const scene = context.scenes.find(s => s.id === sceneId);
    if (scene) {
      enhanced = `${enhanced}, ${scene.location} setting, ${scene.lighting}`;
    }
  }

  return enhanced;
}

// ==================== 降级处理 ====================
export async function handleImageFailure(
  panelId: string, 
  error: Error
): Promise<void> {
  console.error(`[Worker] 面板 ${panelId} 出图失败:`, error.message);
  
  // 记录失败但不阻止整个流程
  await prisma.novelPromotionPanel.update({
    where: { id: panelId },
    data: {
      status: 'failed',
      errorMessage: error.message.slice(0, 500),
      // 使用占位图或保持空白
      imageUrl: process.env.FALLBACK_IMAGE_URL || null,
    },
  });
}

// ==================== 进度预估 ====================
export interface PhaseTiming {
  phase: string;
  estimatedDuration: number;
  weight: number;
}

export const PHASE_TIMINGS: PhaseTiming[] = [
  { phase: 'analyze_novel', estimatedDuration: 60, weight: 10 },
  { phase: 'story_to_script', estimatedDuration: 120, weight: 15 },
  { phase: 'script_to_storyboard', estimatedDuration: 180, weight: 20 },
  { phase: 'image_panels', estimatedDuration: 300, weight: 30 },
  { phase: 'voice', estimatedDuration: 120, weight: 15 },
  { phase: 'video', estimatedDuration: 180, weight: 10 },
];

export function calculateEstimatedRemainingTime(completedPhases: number): number {
  const remainingPhases = PHASE_TIMINGS.slice(completedPhases);
  return remainingPhases.reduce((sum, p) => sum + p.estimatedDuration, 0);
}

export function calculateProgressPercentage(completedPhases: number, totalPhases: number = PHASE_TIMINGS.length): number {
  return Math.round((completedPhases / totalPhases) * 100);
}

// ==================== 批量处理优化 ====================
export async function generateImagesBatch(
  panels: Array<{ id: string; prompt: string }>,
  userId: string,
  batchSize: number = 4
): Promise<Array<{ panelId: string; success: boolean; url?: string; error?: string }>> {
  const results: Array<{ panelId: string; success: boolean; url?: string; error?: string }> = [];
  
  for (let i = 0; i < panels.length; i += batchSize) {
    const batch = panels.slice(i, i + batchSize);
    
    // 并行处理批次
    const batchResults = await Promise.allSettled(
      batch.map(async (panel) => {
        try {
          const result = await generateImage({
            userId,
            prompt: panel.prompt.slice(0, 4000),
            size: "1024x1024",
          });
          return { panelId: panel.id, success: true, url: result.url };
        } catch (error) {
          return { 
            panelId: panel.id, 
            success: false, 
            error: (error as Error).message 
          };
        }
      })
    );
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          panelId: batch[index].id,
          success: false,
          error: result.reason?.message || 'Unknown error',
        });
      }
    });
    
    // 批次间短暂延迟，避免API限流
    if (i + batchSize < panels.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}
