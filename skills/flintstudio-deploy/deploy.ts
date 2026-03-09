/**
 * FlintStudio 部署 Skill - OpenClaw
 * 
 * 这个 Skill 允许 OpenClaw AI 自动部署和管理 FlintStudio 平台
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// 配置
const REPO_URL = "https://github.com/Flintcore/FlintStudio.git";
const DEFAULT_PORT = 13000;
const REQUIRED_PORTS = [13000, 13306, 16379];

interface DeployOptions {
  installPath?: string;
  port?: number;
  mirror?: "official" | "cn" | "global";
  autoFix?: boolean;
}

interface CheckResult {
  success: boolean;
  message: string;
  fix?: () => void;
}

/**
 * 检查系统环境
 */
export function checkEnvironment(): CheckResult[] {
  const results: CheckResult[] = [];

  // 检查操作系统
  const platform = os.platform();
  results.push({
    success: true,
    message: `操作系统: ${platform} (${os.release()})`,
  });

  // 检查 Docker
  try {
    const dockerVersion = execSync("docker --version", { encoding: "utf-8" }).trim();
    results.push({
      success: true,
      message: `✅ Docker 已安装: ${dockerVersion}`,
    });
  } catch {
    results.push({
      success: false,
      message: "❌ Docker 未安装",
      fix: () => {
        console.log("请访问 https://docs.docker.com/get-docker/ 安装 Docker Desktop");
      },
    });
  }

  // 检查 Docker Compose
  try {
    const composeVersion = execSync("docker compose version", { encoding: "utf-8" }).trim();
    results.push({
      success: true,
      message: `✅ Docker Compose 已安装: ${composeVersion}`,
    });
  } catch {
    results.push({
      success: false,
      message: "⚠️ Docker Compose 可能未安装（新版 Docker 已内置）",
    });
  }

  // 检查 Git
  try {
    const gitVersion = execSync("git --version", { encoding: "utf-8" }).trim();
    results.push({
      success: true,
      message: `✅ Git 已安装: ${gitVersion}`,
    });
  } catch {
    results.push({
      success: false,
      message: "❌ Git 未安装",
      fix: () => {
        console.log("请访问 https://git-scm.com/downloads 安装 Git");
      },
    });
  }

  return results;
}

/**
 * 检查端口占用
 */
export function checkPorts(): CheckResult[] {
  const results: CheckResult[] = [];

  for (const port of REQUIRED_PORTS) {
    try {
      // 尝试检查端口是否被占用
      if (os.platform() === "win32") {
        execSync(`netstat -ano | findstr :${port}`, { stdio: "ignore" });
        results.push({
          success: false,
          message: `⚠️ 端口 ${port} 已被占用`,
        });
      } else {
        execSync(`lsof -i :${port}`, { stdio: "ignore" });
        results.push({
          success: false,
          message: `⚠️ 端口 ${port} 已被占用`,
        });
      }
    } catch {
      results.push({
        success: true,
        message: `✅ 端口 ${port} 可用`,
      });
    }
  }

  return results;
}

/**
 * 完整部署流程
 */
export async function deploy(options: DeployOptions = {}): Promise<void> {
  const {
    installPath = path.join(os.homedir(), "FlintStudio"),
    mirror = "official",
    autoFix = true,
  } = options;

  console.log("🎬 FlintStudio 自动部署开始...\n");

  // 1. 环境检查
  console.log("📋 步骤 1/6: 检查系统环境...");
  const envChecks = checkEnvironment();
  for (const check of envChecks) {
    console.log(`  ${check.message}`);
  }

  const failedChecks = envChecks.filter((c) => !c.success);
  if (failedChecks.length > 0) {
    console.error("\n❌ 环境检查未通过，请先安装缺失的依赖:");
    for (const check of failedChecks) {
      if (check.fix) check.fix();
    }
    throw new Error("环境检查失败");
  }

  // 2. 端口检查
  console.log("\n📋 步骤 2/6: 检查端口占用...");
  const portChecks = checkPorts();
  for (const check of portChecks) {
    console.log(`  ${check.message}`);
  }

  // 3. 克隆代码
  console.log("\n📋 步骤 3/6: 克隆代码仓库...");
  if (fs.existsSync(installPath)) {
    console.log(`  ℹ️ 目录 ${installPath} 已存在，尝试更新...`);
    try {
      execSync("git pull", { cwd: installPath, stdio: "inherit" });
      console.log("  ✅ 代码已更新");
    } catch {
      console.log("  ⚠️ 更新失败，将使用现有代码");
    }
  } else {
    console.log(`  📥 克隆到 ${installPath}...`);
    execSync(`git clone ${REPO_URL} "${installPath}"`, { stdio: "inherit" });
    console.log("  ✅ 克隆完成");
  }

  // 4. 配置环境
  console.log("\n📋 步骤 4/6: 配置环境变量...");
  const envPath = path.join(installPath, ".env");
  const envExamplePath = path.join(installPath, ".env.example");

  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log("  ✅ 已创建 .env 配置文件");
    console.log("  ⚠️ 请根据需要编辑 .env 文件配置 API 密钥");
  } else if (fs.existsSync(envPath)) {
    console.log("  ℹ️ .env 文件已存在，跳过配置");
  }

  // 5. 启动服务
  console.log("\n📋 步骤 5/6: 启动 Docker 服务...");

  // 根据镜像源选择构建参数
  const buildArg = mirror !== "official" ? `--build-arg MIRROR=${mirror}` : "";

  try {
    // 先尝试清理旧容器
    console.log("  🧹 清理旧容器...");
    execSync('docker compose down --remove-orphans', { cwd: installPath, stdio: "ignore" });
  } catch {
    // 忽略错误
  }

  // 构建并启动
  console.log(`  🚀 构建并启动服务 (镜像源: ${mirror})...`);
  const composeCmd = buildArg
    ? `docker compose build ${buildArg} && docker compose up -d`
    : "docker compose up -d --build";

  execSync(composeCmd, { cwd: installPath, stdio: "inherit" });
  console.log("  ✅ 服务启动成功");

  // 6. 验证部署
  console.log("\n📋 步骤 6/6: 验证部署状态...");
  await new Promise((resolve) => setTimeout(resolve, 5000)); // 等待服务启动

  try {
    const response = execSync("curl -s -o /dev/null -w '%{http_code}' http://localhost:13000", {
      encoding: "utf-8",
      timeout: 10000,
    });
    if (response.trim() === "200") {
      console.log("  ✅ 服务响应正常");
    } else {
      console.log(`  ⚠️ 服务返回状态码: ${response}`);
    }
  } catch {
    console.log("  ⚠️ 无法连接到服务，请检查日志");
  }

  // 完成
  console.log("\n✨ 部署完成！");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🌐 访问地址: http://localhost:13000");
  console.log("📁 安装目录: " + installPath);
  console.log("📋 查看日志: docker compose logs -f");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n⚠️  使用前请先配置 API 密钥:");
  console.log("   1. 编辑 .env 文件 或");
  console.log("   2. 打开 http://localhost:13000 后进入设置页面");
}

/**
 * 启动服务
 */
export function start(installPath: string = path.join(os.homedir(), "FlintStudio")): void {
  console.log("🚀 启动 FlintStudio...");
  execSync("docker compose up -d", { cwd: installPath, stdio: "inherit" });
  console.log("✅ 服务已启动，访问 http://localhost:13000");
}

/**
 * 停止服务
 */
export function stop(installPath: string = path.join(os.homedir(), "FlintStudio")): void {
  console.log("🛑 停止 FlintStudio...");
  execSync("docker compose down", { cwd: installPath, stdio: "inherit" });
  console.log("✅ 服务已停止");
}

/**
 * 更新版本
 */
export function update(installPath: string = path.join(os.homedir(), "FlintStudio")): void {
  console.log("⬆️  更新 FlintStudio...");

  // 拉取最新代码
  execSync("git pull", { cwd: installPath, stdio: "inherit" });

  // 重新构建
  execSync("docker compose down", { cwd: installPath, stdio: "inherit" });
  execSync("docker compose up -d --build", { cwd: installPath, stdio: "inherit" });

  console.log("✅ 更新完成");
}

/**
 * 查看日志
 */
export function logs(service: string = "app", installPath: string = path.join(os.homedir(), "FlintStudio")): void {
  execSync(`docker compose logs -f ${service}`, { cwd: installPath, stdio: "inherit" });
}

/**
 * 检查状态
 */
export function status(installPath: string = path.join(os.homedir(), "FlintStudio")): void {
  console.log("📊 FlintStudio 运行状态:\n");
  try {
    execSync("docker compose ps", { cwd: installPath, stdio: "inherit" });
  } catch {
    console.log("❌ 无法获取状态，请检查 Docker 是否运行");
  }
}

/**
 * 备份数据库
 */
export function backup(backupPath: string = path.join(os.homedir(), "flintstudio-backups"), installPath: string = path.join(os.homedir(), "FlintStudio")): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupPath, `flintstudio-backup-${timestamp}.sql`);

  // 创建备份目录
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }

  console.log(`💾 备份数据库到 ${backupFile}...`);

  try {
    execSync(
      `docker exec flintstudio-mysqldump -uroot -pflintstudio flintstudio > "${backupFile}"`,
      { cwd: installPath, stdio: "inherit" }
    );
    console.log("✅ 备份完成");
  } catch {
    // 尝试替代方法
    try {
      execSync(
        `docker compose exec -T mysql mysqldump -uroot -pflintstudio flintstudio > "${backupFile}"`,
        { cwd: installPath, stdio: "inherit" }
      );
      console.log("✅ 备份完成");
    } catch (error) {
      console.error("❌ 备份失败:", error);
    }
  }
}

/**
 * 重置数据（危险操作）
 */
export function reset(confirm: string, installPath: string = path.join(os.homedir(), "FlintStudio")): void {
  if (confirm !== "yes") {
    console.log("⚠️  请输入 'yes' 确认重置操作");
    return;
  }

  console.log("🗑️  正在重置所有数据...");
  execSync("docker compose down -v", { cwd: installPath, stdio: "inherit" });
  console.log("✅ 数据已重置，下次启动将重新初始化");
}

// 命令行入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "deploy":
      deploy().catch(console.error);
      break;
    case "start":
      start();
      break;
    case "stop":
      stop();
      break;
    case "update":
      update();
      break;
    case "logs":
      logs(args[1]);
      break;
    case "status":
      status();
      break;
    case "backup":
      backup(args[1]);
      break;
    case "reset":
      reset(args[1]);
      break;
    default:
      console.log("FlintStudio Deploy Skill");
      console.log("Usage: ts-node deploy.ts <command>");
      console.log("\nCommands:");
      console.log("  deploy       完整部署");
      console.log("  start        启动服务");
      console.log("  stop         停止服务");
      console.log("  update       更新版本");
      console.log("  logs [svc]   查看日志");
      console.log("  status       检查状态");
      console.log("  backup [path] 备份数据");
      console.log("  reset yes    重置数据");
  }
}
