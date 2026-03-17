/**
 * Checkpoint Payment Optimizer
 * Strategically places cliffhangers for monetization
 */

import type { EpisodeOutline } from './index';

export interface Checkpoint {
  episode: number;
  type: 'identity-reveal' | 'plot-twist' | 'emotional-peak' | 'battle-result';
  strength: number; // 1-10
  expectedConversion: number; // 预估转化率 %
}

/**
 * 优化卡点位置
 */
export function optimizeCheckpoints(
  outline: EpisodeOutline[],
  totalEpisodes: number
): number[] {
  const checkpoints: number[] = [];
  
  // 黄金卡点位置（基于行业数据）
  const goldenPositions = [10, 20, 30, 40, 50, 60, 70, 80];
  
  // 过滤出有效的卡点位置
  for (const position of goldenPositions) {
    if (position <= totalEpisodes) {
      // 检查该位置是否适合作为卡点
      const episode = outline.find(e => e.episodeNumber === position);
      if (episode && isGoodCheckpoint(episode)) {
        checkpoints.push(position);
      }
    }
  }
  
  // 确保至少有 3 个卡点
  if (checkpoints.length < 3) {
    // 添加额外的卡点
    const additional = findAdditionalCheckpoints(outline, checkpoints, totalEpisodes);
    checkpoints.push(...additional);
  }
  
  // 排序
  return checkpoints.sort((a, b) => a - b);
}

/**
 * 判断是否适合作为卡点
 */
function isGoodCheckpoint(episode: EpisodeOutline): boolean {
  // 卡点需要是 cliffhanger
  if (!episode.cliffhanger) return false;
  
  // 检查摘要中是否有强烈的悬念元素
  const suspenseKeywords = [
    '竟然', '竟然', '没想到', '原来', '真相', '身份', '暴露',
    '发现', '揭露', '揭秘', '反转', '逆袭', '归来',
  ];
  
  const hasSuspense = suspenseKeywords.some(keyword => 
    episode.summary.includes(keyword)
  );
  
  return hasSuspense;
}

/**
 * 寻找额外的卡点位置
 */
function findAdditionalCheckpoints(
  outline: EpisodeOutline[],
  existing: number[],
  totalEpisodes: number
): number[] {
  const additional: number[] = [];
  
  // 在现有卡点之间插入
  for (let i = 0; i < existing.length - 1; i++) {
    const gap = existing[i + 1] - existing[i];
    if (gap > 15) {
      // 间隔太大，中间插入一个
      const middle = Math.floor((existing[i] + existing[i + 1]) / 2);
      if (!additional.includes(middle)) {
        additional.push(middle);
      }
    }
  }
  
  // 如果还不够，从头开始每隔 10 集选一个
  if (additional.length + existing.length < 3) {
    for (let i = 10; i <= totalEpisodes; i += 10) {
      if (!existing.includes(i) && !additional.includes(i)) {
        additional.push(i);
      }
      if (additional.length + existing.length >= 3) break;
    }
  }
  
  return additional;
}

/**
 * 设计卡点类型
 */
export function designCheckpointType(
  episodeNumber: number,
  totalEpisodes: number
): Checkpoint['type'] {
  const progress = episodeNumber / totalEpisodes;
  
  if (progress < 0.15) {
    return 'identity-reveal'; // 身份揭示
  } else if (progress < 0.4) {
    return 'plot-twist'; // 剧情反转
  } else if (progress < 0.7) {
    return 'emotional-peak'; // 情绪高潮
  } else {
    return 'battle-result'; // 战斗结果
  }
}

/**
 * 生成卡点钩子文案
 */
export function generateCheckpointHook(
  episodeNumber: number,
  type: Checkpoint['type']
): string {
  const hooks: Record<Checkpoint['type'], string[]> = {
    'identity-reveal': [
      '点击下方看真相揭露',
      '他的真实身份竟然是...',
      '这一刻，所有人都震惊了',
    ],
    'plot-twist': [
      '剧情大反转，你绝对猜不到',
      '真相竟然是这样...',
      '点击揭晓惊人秘密',
    ],
    'emotional-peak': [
      '最感人的一集来了',
      '准备好纸巾...',
      '情感高潮，点击观看',
    ],
    'battle-result': [
      '最终对决，胜负揭晓',
      '谁才是真正的赢家？',
      '点击看大结局',
    ],
  };
  
  const typeHooks = hooks[type];
  return typeHooks[Math.floor(Math.random() * typeHooks.length)];
}

/**
 * 预估卡点转化率
 */
export function estimateConversion(
  episodeNumber: number,
  type: Checkpoint['type'],
  totalEpisodes: number
): number {
  const baseConversion = 15; // 基础转化率 15%
  
  // 根据类型调整
  const typeMultipliers: Record<Checkpoint['type'], number> = {
    'identity-reveal': 1.5,
    'plot-twist': 1.3,
    'emotional-peak': 1.2,
    'battle-result': 1.4,
  };
  
  // 根据位置调整（开头和结尾的转化率高）
  const progress = episodeNumber / totalEpisodes;
  let positionMultiplier = 1.0;
  if (progress < 0.2) positionMultiplier = 1.3;
  if (progress > 0.8) positionMultiplier = 1.4;
  
  return Math.min(50, Math.round(
    baseConversion * typeMultipliers[type] * positionMultiplier
  ));
}

/**
 * 卡点设计评分
 */
export function evaluateCheckpointDesign(
  checkpoints: Checkpoint[],
  totalEpisodes: number
): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  
  // 检查卡点数量
  if (checkpoints.length < 3) {
    issues.push('卡点太少，付费转化不足');
    suggestions.push('建议增加至少 3 个卡点');
    score -= 20;
  }
  
  if (checkpoints.length > 10) {
    issues.push('卡点太多，用户疲劳');
    suggestions.push('建议减少到 5-8 个');
    score -= 10;
  }
  
  // 检查卡点间隔
  for (let i = 1; i < checkpoints.length; i++) {
    const gap = checkpoints[i].episode - checkpoints[i - 1].episode;
    if (gap < 5) {
      issues.push(`第${checkpoints[i - 1].episode}集和第${checkpoints[i].episode}集间隔太近`);
      suggestions.push('卡点间隔至少 8-12 集');
      score -= 5;
    }
    if (gap > 20) {
      issues.push(`第${checkpoints[i - 1].episode}集和第${checkpoints[i].episode}集间隔太远`);
      suggestions.push('中间可以增加一个卡点');
      score -= 5;
    }
  }
  
  // 检查是否有开头卡点
  if (checkpoints[0]?.episode > 15) {
    suggestions.push('建议前 10-15 集设置第一个卡点');
    score -= 5;
  }
  
  return {
    score: Math.max(0, score),
    issues,
    suggestions,
  };
}
