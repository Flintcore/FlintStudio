#!/usr/bin/env node
/**
 * FlintStudio Complete Management Suite v2.0
 * 合并 flintstudio-deploy + flintstudio-control
 * Beta 0.55 兼容版
 */

import { deploy, start, stop, restart, update } from './lib/deploy';
import { config, status, logs, doctor, optimize, backup, restore, clean } from './lib/maintain';
import { connect, createProject, listProjects, startWorkflow, checkStatus, getResult } from './lib/control';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  console.log('🎬 FlintStudio Management Suite v2.0 (Beta 0.55)');
  console.log('');

  switch (command) {
    // 部署管理命令
    case 'deploy':
      await handleDeploy(args);
      break;
    case 'start':
      await start();
      break;
    case 'stop':
      await stop();
      break;
    case 'restart':
      await handleRestart(args);
      break;
    case 'update':
      await handleUpdate(args);
      break;
    
    // 配置维护命令
    case 'config':
      await handleConfig(args);
      break;
    case 'status':
      await handleStatus(args);
      break;
    case 'logs':
      await handleLogs(args);
      break;
    case 'doctor':
      await handleDoctor(args);
      break;
    case 'optimize':
      await handleOptimize(args);
      break;
    case 'backup':
      await handleBackup(args);
      break;
    case 'restore':
      await handleRestore(args);
      break;
    case 'clean':
      await handleClean(args);
      break;
    
    // 远程控制命令
    case 'connect':
      await handleConnect(args);
      break;
    case 'create-project':
      await handleCreateProject(args);
      break;
    case 'list-projects':
      await listProjects();
      break;
    case 'start-workflow':
      await handleStartWorkflow(args);
      break;
    case 'check-status':
      await handleCheckStatus(args);
      break;
    case 'get-result':
      await handleGetResult(args);
      break;
    
    default:
      showHelp();
  }
}

function showHelp() {
  console.log(`
用法: openclaw run flintstudio <command> [options]

部署管理:
  deploy [options]        完整部署 FlintStudio
  start                   启动服务
  stop                    停止服务
  restart [options]       重启服务
  update [options]        更新到最新版本

配置维护:
  config [options]        配置 API 密钥
  status [options]        检查运行状态
  logs [options]          查看日志
  doctor [options]        系统诊断
  optimize [options]      性能优化 (Beta 0.55)
  backup [options]        备份数据库
  restore --file <path>   从备份恢复
  clean [options]         清理缓存

远程控制:
  connect --url <url>     连接服务器
  create-project --name   创建项目
  list-projects           列出项目
  start-workflow          启动工作流
  check-status --run-id   检查状态
  get-result              获取结果

示例:
  openclaw run flintstudio deploy
  openclaw run flintstudio start
  openclaw run flintstudio connect --url http://localhost:13000
  openclaw run flintstudio create-project --name "我的短剧"
      `);
}

// 命令处理函数
async function handleDeploy(args: string[]) {
  const mirror = getArg(args, '--mirror') || 'official';
  const path = getArg(args, '--path') || '~/FlintStudio';
  await deploy({ mirror, path });
}

async function handleRestart(args: string[]) {
  const quick = getArg(args, '--quick') === 'true';
  await restart({ quick });
}

async function handleUpdate(args: string[]) {
  const force = getArg(args, '--force') === 'true';
  await update({ force });
}

async function handleConfig(args: string[]) {
  const type = getArg(args, '--type') || 'all';
  const show = getArg(args, '--show') === 'true';
  await config({ type, show });
}

async function handleStatus(args: string[]) {
  const verbose = getArg(args, '--verbose') === 'true';
  await status({ verbose });
}

async function handleLogs(args: string[]) {
  const service = getArg(args, '--service') || 'app';
  const lines = parseInt(getArg(args, '--lines') || '100');
  await logs({ service, lines });
}

async function handleDoctor(args: string[]) {
  const fix = getArg(args, '--fix') === 'true';
  const full = getArg(args, '--full') === 'true';
  await doctor({ fix, full });
}

async function handleOptimize(args: string[]) {
  const indexes = getArg(args, '--indexes') !== 'false';
  await optimize({ indexes });
}

async function handleBackup(args: string[]) {
  const path = getArg(args, '--path') || '~/flintstudio-backups';
  await backup({ path });
}

async function handleRestore(args: string[]) {
  const file = getArg(args, '--file');
  if (!file) {
    console.error('❌ 请提供 --file 参数');
    return;
  }
  await restore({ file });
}

async function handleClean(args: string[]) {
  const all = getArg(args, '--all') === 'true';
  await clean({ all });
}

async function handleConnect(args: string[]) {
  const url = getArg(args, '--url');
  if (!url) {
    console.error('❌ 请提供 --url 参数');
    return;
  }
  await connect({ url });
}

async function handleCreateProject(args: string[]) {
  const name = getArg(args, '--name');
  if (!name) {
    console.error('❌ 请提供 --name 参数');
    return;
  }
  await createProject({ name });
}

async function handleStartWorkflow(args: string[]) {
  const projectId = getArg(args, '--project-id');
  const content = getArg(args, '--content');
  const style = getArg(args, '--style') || 'live-action';
  
  if (!projectId || !content) {
    console.error('❌ 请提供 --project-id 和 --content 参数');
    return;
  }
  
  await startWorkflow({ projectId, content, style });
}

async function handleCheckStatus(args: string[]) {
  const runId = getArg(args, '--run-id');
  if (!runId) {
    console.error('❌ 请提供 --run-id 参数');
    return;
  }
  await checkStatus({ runId });
}

async function handleGetResult(args: string[]) {
  const projectId = getArg(args, '--project-id');
  const episode = parseInt(getArg(args, '--episode') || '1');
  
  if (!projectId) {
    console.error('❌ 请提供 --project-id 参数');
    return;
  }
  
  await getResult({ projectId, episode });
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return undefined;
}

main().catch(console.error);
