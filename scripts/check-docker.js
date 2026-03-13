#!/usr/bin/env node
/**
 * Docker 构建前检查脚本
 * 用于诊断常见的构建问题
 */

const fs = require('fs');
const path = require('path');

const errors = [];
const warnings = [];

console.log('🔍 FlintStudio Docker 构建检查\n');

// 1. 检查必要文件
const requiredFiles = ['package.json', 'package-lock.json', 'Dockerfile', 'docker-compose.yml'];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    errors.push(`❌ 缺少必要文件: ${file}`);
  } else {
    console.log(`✅ ${file} 存在`);
  }
}

// 2. 检查 node_modules 是否存在（警告）
if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
  warnings.push('⚠️ node_modules 不存在，建议在构建前运行 npm install');
} else {
  console.log('✅ node_modules 存在');
}

// 3. 检查 .env 文件
if (!fs.existsSync(path.join(process.cwd(), '.env'))) {
  if (fs.existsSync(path.join(process.cwd(), '.env.example'))) {
    warnings.push('⚠️ .env 文件不存在，但找到了 .env.example，请复制并配置: cp .env.example .env');
  } else {
    errors.push('❌ .env 文件和 .env.example 都不存在');
  }
} else {
  console.log('✅ .env 文件存在');
  
  // 检查关键环境变量
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
  const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL', 'NEXTAUTH_SECRET'];
  for (const envVar of requiredEnvVars) {
    if (!envContent.includes(envVar) || envContent.match(new RegExp(`${envVar}=`))?.[0]?.endsWith('=')) {
      warnings.push(`⚠️ ${envVar} 未设置或为空`);
    }
  }
}

// 4. 检查 Dockerfile 是否有常见问题
const dockerfile = fs.readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf8');
if (!dockerfile.includes('mkdir -p public')) {
  warnings.push('⚠️ Dockerfile 可能缺少 "mkdir -p public"，在某些平台可能构建失败');
}

// 5. 检查 package.json 和 package-lock.json 是否同步
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const pkgLock = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package-lock.json'), 'utf8'));
if (pkgLock.packages?.['']?.version !== pkg.version) {
  warnings.push('⚠️ package.json 和 package-lock.json 版本可能不同步，建议运行 npm install');
}

// 6. 检查 public 目录
if (!fs.existsSync(path.join(process.cwd(), 'public'))) {
  console.log('ℹ️ public 目录不存在，Dockerfile 会自动创建');
} else {
  console.log('✅ public 目录存在');
}

// 输出结果
console.log('\n' + '='.repeat(50));
if (errors.length === 0 && warnings.length === 0) {
  console.log('🎉 检查通过！可以运行 docker compose up -d --build');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log('\n❌ 错误（必须修复）:');
    errors.forEach(e => console.log('   ' + e));
  }
  if (warnings.length > 0) {
    console.log('\n⚠️ 警告（建议修复）:');
    warnings.forEach(w => console.log('   ' + w));
  }
  console.log('\n' + '='.repeat(50));
  if (errors.length > 0) {
    console.log('⛔ 请先修复错误后再构建');
    process.exit(1);
  } else {
    console.log('💡 可以继续构建，但建议处理警告');
    process.exit(0);
  }
}
