#!/usr/bin/env node
/**
 * FlintStudio 环境初始化向导
 * 检查运行环境、创建 .env、初始化数据库
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = process.cwd();
const OK = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

function header(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  console.log('─'.repeat(48));
}

function pass(msg) { console.log(`  ${OK}  ${msg}`); }
function fail(msg) { console.log(`  ${FAIL}  ${msg}`); }
function warn(msg) { console.log(`  ${WARN}  ${msg}`); }
function info(msg) { console.log(`  ${INFO}  ${msg}`); }

let hasErrors = false;

// ── 1. Node 版本检查 ──
header('1. 运行环境检查');
const nodeVer = process.versions.node.split('.').map(Number);
if (nodeVer[0] >= 18 && (nodeVer[0] > 18 || nodeVer[1] >= 18)) {
  pass(`Node.js ${process.versions.node}`);
} else {
  fail(`Node.js ${process.versions.node}（需要 >=18.18.0）`);
  hasErrors = true;
}

// npm 版本
try {
  const npmVer = execSync('npm --version', { encoding: 'utf8' }).trim().split('.').map(Number);
  if (npmVer[0] >= 9) {
    pass(`npm ${execSync('npm --version', { encoding: 'utf8' }).trim()}`);
  } else {
    warn(`npm ${npmVer.join('.')}（建议 >=9.0.0）`);
  }
} catch {
  warn('npm 未检测到');
}

// ── 2. node_modules ──
header('2. 依赖检查');
if (fs.existsSync(path.join(ROOT, 'node_modules'))) {
  pass('node_modules 已存在');
} else {
  warn('node_modules 不存在，自动运行 npm install ...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: ROOT });
    pass('npm install 完成');
  } catch {
    fail('npm install 失败，请手动运行 npm install');
    hasErrors = true;
  }
}

// ── 3. .env 文件 ──
header('3. 环境变量配置');
const envPath = path.join(ROOT, '.env');
const envExamplePath = path.join(ROOT, '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    pass('.env 已从 .env.example 创建');
    warn('请编辑 .env 文件，设置以下必填项：');
    info('  DATABASE_URL  — MySQL 连接字符串');
    info('  NEXTAUTH_SECRET  — 随机密钥（可运行 openssl rand -base64 32 生成）');
    info('  INTERNAL_TASK_TOKEN  — Worker 内部通信令牌');
    info('  REDIS_HOST / REDIS_PORT  — Redis 连接信息');
  } else {
    fail('.env 和 .env.example 均不存在，请手动创建 .env');
    hasErrors = true;
  }
} else {
  pass('.env 文件存在');
  // 检查关键变量是否为默认占位符
  const envContent = fs.readFileSync(envPath, 'utf8');
  const placeholders = [
    ['NEXTAUTH_SECRET', 'please-change'],
    ['INTERNAL_TASK_TOKEN', 'please-change'],
    ['API_ENCRYPTION_KEY', 'please-change'],
  ];
  for (const [key, placeholder] of placeholders) {
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (!match) {
      warn(`${key} 未设置`);
    } else if (match[1].includes(placeholder)) {
      warn(`${key} 仍为默认值，生产环境请修改`);
    } else {
      pass(`${key} 已设置`);
    }
  }
}

// ── 4. Redis 连通性 ──
header('4. Redis 连通性测试');
try {
  // 从 .env 读取 Redis 配置
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const getEnv = (key, def) => {
    const m = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return m ? m[1].replace(/['"]/g, '').trim() : def;
  };
  const host = getEnv('REDIS_HOST', '127.0.0.1');
  const port = getEnv('REDIS_PORT', '6379');
  // 用 redis-cli ping 检测
  const result = spawnSync('redis-cli', ['-h', host, '-p', port, 'ping'], {
    encoding: 'utf8',
    timeout: 3000,
  });
  if (result.stdout && result.stdout.trim() === 'PONG') {
    pass(`Redis ${host}:${port} 连接正常`);
  } else {
    warn(`Redis ${host}:${port} 未响应（redis-cli ping 失败）`);
    info('  请确保 Redis 服务已启动：redis-server');
  }
} catch {
  warn('redis-cli 未找到，跳过 Redis 检测');
  info('  请确保 Redis 已安装并运行');
}

// ── 5. 数据库初始化 ──
header('5. 数据库初始化');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('DATABASE_URL') && !envContent.match(/DATABASE_URL=\s*$/m)) {
    info('运行 npx prisma db push ...');
    try {
      execSync('npx prisma db push', { stdio: 'inherit', cwd: ROOT });
      pass('数据库 Schema 已同步');
    } catch {
      fail('prisma db push 失败，请检查 DATABASE_URL 是否正确');
      hasErrors = true;
    }
  } else {
    warn('DATABASE_URL 未配置，跳过数据库初始化');
  }
} else {
  warn('.env 不存在，跳过数据库初始化');
}

// ── 汇总 ──
console.log('\n' + '═'.repeat(48));
if (hasErrors) {
  console.log('\x1b[31m  ✗  存在错误，请修复后重新运行 npm run setup\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m  ✓  初始化完成！\x1b[0m');
  console.log('\n  接下来：');
  info('  编辑 .env 配置 API Key 等变量');
  info('  npm run dev  — 启动开发服务器');
  info('  npm run build && npm start  — 生产模式');
  process.exit(0);
}
