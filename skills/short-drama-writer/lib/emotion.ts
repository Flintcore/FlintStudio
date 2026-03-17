/**
 * Emotional Curve Designer
 * Designs emotional arcs for episode retention
 */

export interface EmotionPoint {
  episode: number;
  emotion: 'depression' | 'hope' | 'setback' | 'counterattack' | 'satisfaction';
  intensity: number; // 1-10
}

export interface EmotionCycle {
  startEpisode: number;
  endEpisode: number;
  phases: {
    depression: number;   // 压抑
    hope: number;         // 希望
    setback: number;      // 挫折
    counterattack: number;// 反击
    satisfaction: number; // 爽点
  };
}

/**
 * 设计情绪曲线
 */
export function designEmotionCurve(totalEpisodes: number): EmotionPoint[] {
  const curve: EmotionPoint[] = [];
  
  // 短剧情绪曲线公式：每 8-10 集一个完整情绪周期
  const cycleLength = Math.min(10, Math.max(8, Math.floor(totalEpisodes / 8)));
  const cycles = Math.ceil(totalEpisodes / cycleLength);
  
  for (let cycle = 0; cycle < cycles; cycle++) {
    const cycleStart = cycle * cycleLength + 1;
    const cycleEnd = Math.min((cycle + 1) * cycleLength, totalEpisodes);
    
    const cycleEmotions = generateCycleEmotions(cycleStart, cycleEnd, cycle);
    curve.push(...cycleEmotions);
  }
  
  return curve;
}

/**
 * 生成一个情绪周期的点
 */
function generateCycleEmotions(
  start: number,
  end: number,
  cycleIndex: number
): EmotionPoint[] {
  const points: EmotionPoint[] = [];
  const length = end - start + 1;
  
  // 情绪周期结构：
  // 0-20%: 压抑 (建立冲突)
  // 20-40%: 希望 (转机出现)
  // 40-60%: 挫折 (再次打压)
  // 60-85%: 反击 (开始翻盘)
  // 85-100%: 爽点 (大胜)
  
  for (let i = 0; i < length; i++) {
    const progress = i / length;
    const episode = start + i;
    
    let emotion: EmotionPoint['emotion'];
    let intensity: number;
    
    if (progress < 0.2) {
      emotion = 'depression';
      intensity = Math.min(10, 5 + cycleIndex + progress * 20);
    } else if (progress < 0.4) {
      emotion = 'hope';
      intensity = Math.min(10, 4 + progress * 15);
    } else if (progress < 0.6) {
      emotion = 'setback';
      intensity = Math.min(10, 6 + (progress - 0.4) * 20);
    } else if (progress < 0.85) {
      emotion = 'counterattack';
      intensity = Math.min(10, 5 + (progress - 0.6) * 20);
    } else {
      emotion = 'satisfaction';
      intensity = Math.min(10, 8 + cycleIndex);
    }
    
    points.push({
      episode,
      emotion,
      intensity: Math.round(intensity),
    });
  }
  
  return points;
}

/**
 * 获取情绪说明
 */
export function getEmotionDescription(emotion: EmotionPoint['emotion']): string {
  const descriptions: Record<EmotionPoint['emotion'], string> = {
    depression: '主角被欺负/羞辱，观众愤怒同情',
    hope: '转机出现，观众期待',
    setback: '再次被打压，观众着急',
    counterattack: '开始反击，观众解气',
    satisfaction: '大获全胜，观众爽',
  };
  return descriptions[emotion];
}

/**
 * 计算情绪曲线评分
 */
export function calculateEmotionScore(curve: EmotionPoint[]): number {
  if (curve.length === 0) return 0;
  
  let score = 0;
  
  // 检查是否有完整的情绪周期
  const hasAllEmotions = ['depression', 'hope', 'setback', 'counterattack', 'satisfaction']
    .every(e => curve.some(point => point.emotion === e));
  
  if (hasAllEmotions) score += 30;
  
  // 检查情绪强度是否足够
  const avgIntensity = curve.reduce((sum, p) => sum + p.intensity, 0) / curve.length;
  if (avgIntensity >= 6) score += 30;
  
  // 检查情绪变化是否明显
  const changes = curve.filter((p, i) => i > 0 && p.emotion !== curve[i - 1].emotion).length;
  if (changes >= curve.length / 5) score += 20;
  
  // 检查爽点是否足够
  const satisfactions = curve.filter(p => p.emotion === 'satisfaction').length;
  if (satisfactions >= 2) score += 20;
  
  return Math.min(100, score);
}

/**
 * 获取特定集的情绪建议
 */
export function getEmotionAdvice(
  episode: number,
  currentEmotion: EmotionPoint['emotion']
): string {
  const adviceMap: Record<EmotionPoint['emotion'], string[]> = {
    depression: [
      '增加羞辱台词',
      '强调主角的无助',
      '通过眼神/动作表现内心',
    ],
    hope: [
      '给主角一个机会',
      '暗示转机到来',
      '但不要给太多',
    ],
    setback: [
      '反派再次打压',
      '增加意外阻碍',
      '让观众更着急',
    ],
    counterattack: [
      '主角开始行动',
      '小胜利铺垫',
      '节奏加快',
    ],
    satisfaction: [
      '打脸反派',
      '真相大白',
      '观众最爽时刻',
    ],
  };
  
  const advice = adviceMap[currentEmotion];
  return advice[Math.floor(Math.random() * advice.length)];
}
