/**
 * Self-Evolution Engine
 * Learns from successful cases and updates templates
 */

import type { GenreTemplate } from './templates';
import { getGenreTemplate, listGenres } from './templates';
import { updateHookEffectiveness } from './hooks';

// 成功案例数据库
interface SuccessCase {
  id: string;
  title: string;
  genre: string;
  episodes: number;
  metrics: {
    retentionRate: number;      // 留存率
    conversionRate: number;     // 付费转化率
    completionRate: number;     // 完播率
    shareRate: number;          // 分享率
  };
  patterns: {
    hookType: string;
    checkpointPositions: number[];
    emotionCurve: string;
    cliffhangerStrength: number;
  };
  timestamp: number;
}

// 内存中的成功案例库（实际应用中应持久化到数据库）
let successCases: SuccessCase[] = [];

/**
 * 从成功案例学习
 */
export async function updateTemplatesFromSuccess(caseData: string): Promise<void> {
  try {
    const caseInfo: SuccessCase = JSON.parse(caseData);
    
    // 验证案例数据
    if (!isValidCase(caseInfo)) {
      console.error('❌ 无效的案例数据');
      return;
    }
    
    // 添加到案例库
    successCases.push({
      ...caseInfo,
      timestamp: Date.now(),
    });
    
    // 保持案例库大小（最近 100 个）
    if (successCases.length > 100) {
      successCases = successCases.slice(-100);
    }
    
    // 分析并更新模板
    analyzeAndUpdate(caseInfo);
    
    console.log(`✅ 已学习案例：${caseInfo.title}`);
    console.log(`📊 留存率：${caseInfo.metrics.retentionRate}%，转化率：${caseInfo.metrics.conversionRate}%`);
  } catch (error) {
    console.error('❌ 解析案例失败:', error);
  }
}

/**
 * 验证案例数据
 */
function isValidCase(caseInfo: any): caseInfo is SuccessCase {
  return (
    caseInfo &&
caseInfo.id &&
    caseInfo.title &&
    caseInfo.genre &&
    caseInfo.metrics &&
    typeof caseInfo.metrics.retentionRate === 'number' &&
    typeof caseInfo.metrics.conversionRate === 'number'
  );
}

/**
 * 分析案例并更新模板
 */
function analyzeAndUpdate(successCase: SuccessCase): void {
  const { metrics, patterns, genre } = successCase;
  
  // 1. 更新钩子效果评分
  if (metrics.retentionRate > 60) {
    updateHookEffectiveness(patterns.hookType, true);
  }
  
  // 2. 分析卡点位置模式
  if (metrics.conversionRate > 20) {
    updateCheckpointPatterns(genre, patterns.checkpointPositions);
  }
  
  // 3. 更新类型模板参数
  if (metrics.completionRate > 40) {
    updateGenreParameters(genre, patterns);
  }
}

/**
 * 更新卡点位置模式
 */
function updateCheckpointPatterns(genre: string, positions: number[]): void {
  // 存储最佳卡点位置模式
  // 实际应用中应持久化到配置
  console.log(`📝 更新 ${genre} 类型的卡点模式：${positions.join(', ')}`);
}

/**
 * 更新类型参数
 */
function updateGenreParameters(genre: string, patterns: SuccessCase['patterns']): void {
  // 根据成功案例调整类型模板
  console.log(`📝 优化 ${genre} 类型参数：`, patterns);
}

/**
 * 获取最佳实践
 */
export function getBestPractices(genre?: string): {
  hookType: string;
  checkpointInterval: number;
  emotionCycle: number;
  cliffhangerStrength: number;
} {
  // 筛选相关案例
  const relevantCases = genre
    ? successCases.filter(c => c.genre === genre)
    : successCases;
  
  if (relevantCases.length === 0) {
    // 返回默认值
    return {
      hookType: 'conflict',
      checkpointInterval: 10,
      emotionCycle: 8,
      cliffhangerStrength: 8,
    };
  }
  
  // 找出效果最好的案例
  const bestCase = relevantCases.sort((a, b) => {
    const scoreA = a.metrics.retentionRate + a.metrics.conversionRate * 2;
    const scoreB = b.metrics.retentionRate + b.metrics.conversionRate * 2;
    return scoreB - scoreA;
  })[0];
  
  return {
    hookType: bestCase.patterns.hookType,
    checkpointInterval: calculateAverageInterval(bestCase.patterns.checkpointPositions),
    emotionCycle: 8, // 基于情绪曲线分析
    cliffhangerStrength: bestCase.patterns.cliffhangerStrength,
  };
}

/**
 * 计算平均卡点间隔
 */
function calculateAverageInterval(positions: number[]): number {
  if (positions.length < 2) return 10;
  
  let totalGap = 0;
  for (let i = 1; i < positions.length; i++) {
    totalGap += positions[i] - positions[i - 1];
  }
  
  return Math.round(totalGap / (positions.length - 1));
}

/**
 * 生成趋势报告
 */
export function generateTrendReport(): {
  totalCases: number;
  avgRetention: number;
  avgConversion: number;
  bestGenre: string;
  trendingThemes: string[];
} {
  if (successCases.length === 0) {
    return {
      totalCases: 0,
      avgRetention: 0,
      avgConversion: 0,
      bestGenre: 'urban-power',
      trendingThemes: [],
    };
  }
  
  const totalCases = successCases.length;
  const avgRetention = successCases.reduce((sum, c) => sum + c.metrics.retentionRate, 0) / totalCases;
  const avgConversion = successCases.reduce((sum, c) => sum + c.metrics.conversionRate, 0) / totalCases;
  
  // 计算最佳类型
  const genreScores: Record<string, number> = {};
  successCases.forEach(c => {
    if (!genreScores[c.genre]) genreScores[c.genre] = 0;
    genreScores[c.genre] += c.metrics.retentionRate + c.metrics.conversionRate;
  });
  
  const bestGenre = Object.entries(genreScores)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'urban-power';
  
  // 提取热门主题
  const themeCounts: Record<string, number> = {};
  successCases.forEach(c => {
    // 这里简化处理，实际应从案例中提取主题
    const themes = ['revenge', 'romance', 'power'];
    themes.forEach(t => {
      themeCounts[t] = (themeCounts[t] || 0) + 1;
    });
  });
  
  const trendingThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);
  
  return {
    totalCases,
    avgRetention: Math.round(avgRetention),
    avgConversion: Math.round(avgConversion),
    bestGenre,
    trendingThemes,
  };
}

/**
 * 导出案例库
 */
export function exportCaseDatabase(): string {
  return JSON.stringify(successCases, null, 2);
}

/**
 * 导入案例库
 */
export function importCaseDatabase(data: string): void {
  try {
    const cases = JSON.parse(data);
    if (Array.isArray(cases)) {
      successCases = cases.filter(isValidCase);
      console.log(`✅ 已导入 ${successCases.length} 个案例`);
    }
  } catch (error) {
    console.error('❌ 导入案例库失败:', error);
  }
}
