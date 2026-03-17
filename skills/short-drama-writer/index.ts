#!/usr/bin/env node
/**
 * Short Drama Writer Skill - Main Entry Point
 * Beta 0.55 - Self-evolving AI script creator
 */

import { createDrama, analyzeScript, learnFromCase, evolveTemplates } from './lib';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'create':
      await handleCreate(args);
      break;
    case 'analyze':
      await handleAnalyze(args);
      break;
    case 'learn':
      await handleLearn(args);
      break;
    case 'evolve':
      await handleEvolve(args);
      break;
    default:
      console.log(`
Short Drama Writer Skill - Self-evolving AI script creator

Commands:
  create    Create a new short drama script
  analyze   Analyze and optimize existing script
  learn     Learn from successful case study
  evolve    Trigger template evolution

Usage:
  openclaw run short-drama-writer create --title "Title" --genre urban-power
  openclaw run short-drama-writer analyze --file script.txt
  openclaw run short-drama-writer learn --case case.json
  openclaw run short-drama-writer evolve
      `);
  }
}

async function handleCreate(args: string[]) {
  const title = getArg(args, '--title') || '未命名短剧';
  const genre = getArg(args, '--genre') || 'urban-power';
  const episodes = parseInt(getArg(args, '--episodes') || '80');
  const target = getArg(args, '--target') || 'revenge,face-slapping';
  const output = getArg(args, '--output') || './output.json';

  console.log(`🎬 创建短剧: ${title}`);
  console.log(`📊 类型: ${genre}, ${episodes}集`);
  console.log(`🎯 目标: ${target}`);

  const result = await createDrama({
    title,
    genre,
    episodes,
    targetThemes: target.split(','),
  });

  console.log(`✅ 创建完成！输出: ${output}`);
  console.log(`📈 预估卡点位置: ${result.checkpoints.join(', ')}`);
  console.log(`💰 付费点设计: ${result.paymentStrategy}`);
}

async function handleAnalyze(args: string[]) {
  const file = getArg(args, '--file');
  if (!file) {
    console.error('❌ 请提供 --file 参数');
    return;
  }

  console.log(`📖 分析剧本: ${file}`);
  
  const result = await analyzeScript(file);
  
  console.log('📊 分析结果:');
  console.log(`  - 情绪曲线评分: ${result.emotionScore}/100`);
  console.log(`  - 卡点强度: ${result.checkpointStrength}`);
  console.log(`  - 预计留存率: ${result.retentionEstimate}%`);
  console.log(`  - 改进建议: ${result.suggestions.length}条`);
}

async function handleLearn(args: string[]) {
  const caseFile = getArg(args, '--case');
  if (!caseFile) {
    console.error('❌ 请提供 --case 参数');
    return;
  }

  console.log(`🧠 学习案例: ${caseFile}`);
  
  await learnFromCase(caseFile);
  
  console.log('✅ 学习完成，模板已更新');
}

async function handleEvolve(args: string[]) {
  console.log('🔄 启动模板进化...');
  
  await evolveTemplates();
  
  console.log('✅ 进化完成');
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return undefined;
}

main().catch(console.error);
