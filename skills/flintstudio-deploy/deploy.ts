/**
 * FlintStudio 部署 Skill - OpenClaw v1.1.0
 * 
 * 这个 Skill 允许 OpenClaw AI 自动部署和管理 FlintStudio 平台
 * 新增功能：config、restart、clean、shell、doctor、port、restore
 */

import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";

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
  severity?: "info" | "warning" | "error" | "critical";
}

interface PortMapping {
  service: string;
  internal: number;
  external: number;
  description: string;
}

// 默认端口映射
const DEFAULT_PORT_MAPPINGS: PortMapping[] = [
  { service: "app", internal: 3000, external: 13000, description: "FlintStudio Web 服务" },
  { service: "mysql", internal: 3306, external: 13306, description: "MySQL 数据库" },
  { service: "redis", internal: 6379, external: 16379, description: "Redis 缓存" },
];

/**
 * 创建 readline 接口用于交互
 */
function createRL(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 询问用户问题
 */
function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
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
    severity: "info",
  });

  // 检查 Docker
  try {
    const dockerVersion = execSync("docker --version", { encoding: "utf-8" }).trim();
    results.push({
      success: true,
      message: `✅ Docker 已安装: ${dockerVersion}`,
      severity: "info",
    });
  } catch {
    results.push({
      success: false,
      message: "❌ Docker 未安装",
      severity: "critical",
      fix: () => {
        console.log("📥 请访问 https://docs.docker.com/get-docker/ 安装 Docker Desktop");
        if (os.platform() === "win32") {
          console.log("   Windows: winget install Docker.DockerDesktop");
        } else if (os.platform() === "darwin") {
          console.log("   macOS: brew install --cask docker");
        } else {
          console.log("   Linux: curl -fsSL https://get.docker.com | sh");
        }
      },
    });
  }

  // 检查 Docker Compose
  try {
    const composeVersion = execSync("docker compose version", { encoding: "utf-8" }).trim();
    results.push({
      success: true,
      message: `✅ Docker Compose 已安装: ${composeVersion}`,
      severity: "info",
    });
  } catch {
    results.push({
      success: false,
      message: "⚠️ Docker Compose 可能未安装（新版 Docker 已内置）",
      severity: "warning",
    });
  }

  // 检查 Docker 守护进程
  try {
    execSync("docker info", { stdio: "ignore" });
    results.push({
      success: true,
      message: "✅ Docker 守护进程运行正常",
      severity: "info",
    });
  } catch {
    results.push({
      success: false,
      message: "❌ Docker 守护进程未运行",
      severity: "critical",
      fix: () => {
        console.log("🚀 请启动 Docker Desktop 或 Docker 服务");
        if (os.platform() !== "win32" && os.platform() !== "darwin") {
          console.log("   sudo systemctl start docker");
        }
      },
    });
  }

  // 检查 Git
  try {
    const gitVersion = execSync("git --version", { encoding: "utf-8" }).trim();
    results.push({
      success: true,
      message: `✅ Git 已安装: ${gitVersion}`,
      severity: "info",
    });
  } catch {
    results.push({
      success: false,
      message: "❌ Git 未安装",
      severity: "error",
      fix: () => {
        console.log("📥 请访问 https://git-scm.com/downloads 安装 Git");
      },
    });
  }

  // 检查 Node.js
  try {
    const nodeVersion = execSync("node --version", { encoding: "utf-8" }).trim();
    results.push({
      success: true,
      message: `✅ Node.js 已安装: ${nodeVersion}`,
      severity: "info",
    });
  } catch {
    results.push({
      success: false,
      message: "⚠️ Node.js 未安装（可选，用于高级功能）",
      severity: "warning",
    });
  }

  // 检查系统资源
  const totalMem = os.totalmem() / (1024 * 1024 * 1024);
  const freeMem = os.freemem() / (1024 * 1024 * 1024);
  if (totalMem < 4) {
    results.push({
      success: false,
      message: `⚠️ 内存不足: ${totalMem.toFixed(1)}GB (建议至少 4GB)`,
      severity: "warning",
    });
  } else {
    results.push({
      success: true,
      message: `✅ 内存: ${freeMem.toFixed(1)}GB / ${totalMem.toFixed(1)}GB 可用`,
      severity: "info",
    });
  }

  return results;
}

/**
 * 检查端口占用
 */
export function checkPorts(ports: number[] = REQUIRED_PORTS): CheckResult[] {
  const results: CheckResult[] = [];

  for (const port of ports) {
    try {
      // 尝试检查端口是否被占用
      if (os.platform() === "win32") {
        execSync(`netstat -ano | findstr :${port}`, { stdio: "ignore" });
        results.push({
          success: false,
          message: `⚠️ 端口 ${port} 已被占用`,
          severity: "warning",
        });
      } else {
        execSync(`lsof -i :${port}`, { stdio: "ignore" });
        results.push({
          success: false,
          message: `⚠️ 端口 ${port} 已被占用`,
          severity: "warning",
        });
      }
    } catch {
      results.push({
        success: true,
        message: `✅ 端口 ${port} 可用`,
        severity: "info",
      });
    }
  }

  return results;
}

/**
 * 查找可用端口
 */
export function findAvailablePort(startPort: number = 13000): number {
  for (let port = startPort; port < startPort + 1000; port++) {
    try {
      if (os.platform() === "win32") {
        execSync(`netstat -ano | findstr :${port}`, { stdio: "ignore" });
      } else {
        execSync(`lsof -i :${port}`, { stdio: "ignore" });
      }
    } catch {
      return port;
    }
  }
  return startPort;
}

/**
 * 获取安装路径
 */
function getInstallPath(customPath?: string): string {
  return customPath || path.join(os.homedir(), "FlintStudio");
}

/**
 * 完整部署流程
 */
export async function deploy(options: DeployOptions = {}): Promise<void> {
  const {
    installPath = getInstallPath(),
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

  const criticalIssues = envChecks.filter((c) => c.severity === "critical" && !c.success);
  if (criticalIssues.length > 0) {
    console.error("\n❌ 环境检查未通过，请先修复以下问题:");
    for (const check of criticalIssues) {
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

  const occupiedPorts = portChecks.filter((c) => !c.success);
  if (occupiedPorts.length > 0 && autoFix) {
    console.log("\n🔧 检测到端口占用，尝试自动寻找可用端口...");
    for (const portResult of occupiedPorts) {
      const portMatch = portResult.message.match(/端口 (\d+)/);
      if (portMatch) {
        const newPort = findAvailablePort(parseInt(portMatch[1]));
        console.log(`  💡 端口 ${portMatch[1]} 被占用，建议使用 ${newPort}`);
      }
    }
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
    console.log(`  📝 配置文件路径: ${envPath}`);
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
  console.log("   1. 运行: openclaw run flintstudio-deploy config");
  console.log("   2. 或编辑 .env 文件");
  console.log("   3. 或打开 http://localhost:13000 后进入设置页面");
}

/**
 * 启动服务
 */
export function start(installPath: string = getInstallPath()): void {
  console.log("🚀 启动 FlintStudio...");
  
  if (!fs.existsSync(installPath)) {
    console.error(`❌ 安装目录不存在: ${installPath}`);
    console.log("💡 请先运行部署命令: deploy");
    return;
  }
  
  try {
    execSync("docker compose up -d", { cwd: installPath, stdio: "inherit" });
    console.log("✅ 服务已启动");
    console.log("🌐 访问地址: http://localhost:13000");
    
    // 检查服务健康状态
    setTimeout(() => {
      try {
        execSync("docker compose ps", { cwd: installPath, stdio: "inherit" });
      } catch {
        // 忽略错误
      }
    }, 3000);
  } catch (error) {
    console.error("❌ 启动失败:", error);
    console.log("💡 尝试诊断问题...");
    doctor(false, installPath);
  }
}

/**
 * 停止服务
 */
export function stop(installPath: string = getInstallPath()): void {
  console.log("🛑 停止 FlintStudio...");
  
  if (!fs.existsSync(installPath)) {
    console.error(`❌ 安装目录不存在: ${installPath}`);
    return;
  }
  
  try {
    execSync("docker compose down", { cwd: installPath, stdio: "inherit" });
    console.log("✅ 服务已停止");
  } catch (error) {
    console.error("❌ 停止失败:", error);
  }
}

/**
 * 重启服务
 */
export function restart(quick: boolean = false, installPath: string = getInstallPath()): void {
  console.log(`🔄 ${quick ? '快速' : '完整'}重启 FlintStudio...`);
  
  if (!fs.existsSync(installPath)) {
    console.error(`❌ 安装目录不存在: ${installPath}`);
    return;
  }
  
  try {
    if (quick) {
      // 快速重启 - 不重建容器
      console.log("  🚀 快速重启中...");
      execSync("docker compose restart", { cwd: installPath, stdio: "inherit" });
    } else {
      // 完整重启 - 重新构建并启动
      console.log("  🏗️  重新构建并启动...");
      execSync("docker compose down", { cwd: installPath, stdio: "inherit" });
      execSync("docker compose up -d --build", { cwd: installPath, stdio: "inherit" });
    }
    console.log("✅ 重启完成");
    console.log("🌐 访问地址: http://localhost:13000");
  } catch (error) {
    console.error("❌ 重启失败:", error);
  }
}

/**
 * 更新版本
 */
export function update(force: boolean = false, installPath: string = getInstallPath()): void {
  console.log("⬆️  更新 FlintStudio...");
  
  if (!fs.existsSync(installPath)) {
    console.error(`❌ 安装目录不存在: ${installPath}`);
    return;
  }

  try {
    // 停止服务
    console.log("  🛑 停止服务...");
    execSync("docker compose down", { cwd: installPath, stdio: "ignore" });
    
    // 拉取最新代码
    console.log("  📥 拉取最新代码...");
    if (force) {
      execSync("git reset --hard HEAD", { cwd: installPath, stdio: "inherit" });
    }
    execSync("git pull", { cwd: installPath, stdio: "inherit" });
    
    // 重新构建并启动
    console.log("  🏗️  重新构建...");
    execSync("docker compose up -d --build", { cwd: installPath, stdio: "inherit" });
    
    console.log("✅ 更新完成");
  } catch (error) {
    console.error("❌ 更新失败:", error);
    console.log("💡 尝试使用 --force 参数强制更新");
  }
}

/**
 * 查看日志
 */
export function logs(service: string = "app", lines: number = 100, installPath: string = getInstallPath()): void {
  if (!fs.existsSync(installPath)) {
    console.error(`❌ 安装目录不存在: ${installPath}`);
    return;
  }
  
  const serviceArg = service === "all" ? "" : service;
  try {
    execSync(`docker compose logs --tail=${lines} -f ${serviceArg}`, { cwd: installPath, stdio: "inherit" });
  } catch {
    console.log("📋 日志查看已退出");
  }
}

/**
 * 检查状态
 */
export function status(verbose: boolean = false, installPath: string = getInstallPath()): void {
  console.log("📊 FlintStudio 运行状态:\n");
  
  if (!fs.existsSync(installPath)) {
    console.log("❌ 未找到安装目录");
    console.log(`💡 预期路径: ${installPath}`);
    console.log("   运行 deploy 命令进行部署");
    return;
  }
  
  console.log(`📁 安装路径: ${installPath}\n`);
  
  try {
    // 显示容器状态
    console.log("🐳 Docker 容器状态:");
    execSync("docker compose ps", { cwd: installPath, stdio: "inherit" });
    
    if (verbose) {
      console.log("\n📈 资源使用情况:");
      try {
        execSync('docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}"', { 
          cwd: installPath, 
          stdio: "inherit" 
        });
      } catch {
        console.log("⚠️ 无法获取资源使用情况");
      }
      
      console.log("\n🔍 服务健康检查:");
      try {
        const response = execSync("curl -s http://localhost:13000/api/health || echo 'unhealthy'", {
          encoding: "utf-8",
          timeout: 5000,
        });
        console.log(response.includes("unhealthy") ? "⚠️  服务健康检查失败" : "✅ 服务健康检查通过");
      } catch {
        console.log("⚠️ 无法连接到服务");
      }
    }
  } catch {
    console.log("❌ 无法获取状态，请检查 Docker 是否运行");
  }
}

/**
 * 交互式配置 API 密钥
 */
export async function config(type: string = "all", show: boolean = false, installPath: string = getInstallPath()): Promise<void> {
  const envPath = path.join(installPath, ".env");
  
  if (!fs.existsSync(installPath)) {
    console.error(`❌ 安装目录不存在: ${installPath}`);
    console.log("💡 请先运行 deploy 命令部署 FlintStudio");
    return;
  }
  
  // 显示当前配置
  if (show) {
    console.log("📋 当前配置:\n");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      // 只显示配置项名称，隐藏实际值
      const lines = envContent.split("\n");
      for (const line of lines) {
        if (line.startsWith("#") || line.trim() === "") {
          console.log(line);
        } else if (line.includes("=")) {
          const [key] = line.split("=");
          console.log(`${key}=***`);
        }
      }
    } else {
      console.log("⚠️ 未找到 .env 配置文件");
    }
    return;
  }
  
  const rl = createRL();
  
  try {
    console.log("🔧 FlintStudio API 配置向导\n");
    console.log("═══════════════════════════════════════");
    
    // 读取现有配置
    let envConfig: Record<string, string> = {};
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        if (line.includes("=") && !line.startsWith("#")) {
          const [key, ...valueParts] = line.split("=");
          envConfig[key] = valueParts.join("=");
        }
      }
    }
    
    // LLM API 配置
    if (type === "all" || type === "llm") {
      console.log("\n🤖 LLM (大语言模型) API 配置");
      console.log("─────────────────────────────────────");
      
      console.log("\n📚 支持的 LLM 服务商:");
      console.log("  1. OpenAI (gpt-4, gpt-3.5-turbo)");
      console.log("  2. Azure OpenAI");
      console.log("  3. Anthropic Claude");
      console.log("  4. Google Gemini");
      console.log("  5. DeepSeek (国内)");
      console.log("  6. 月之暗面 Moonshot (国内)");
      console.log("  7. 智谱 AI GLM (国内)");
      
      const llmProvider = await askQuestion(rl, "\n请选择 LLM 服务商 (1-7，直接回车跳过): ");
      
      if (llmProvider.trim()) {
        const providerMap: Record<string, { name: string; baseUrl: string }> = {
          "1": { name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
          "2": { name: "Azure OpenAI", baseUrl: "https://your-resource.openai.azure.com" },
          "3": { name: "Anthropic", baseUrl: "https://api.anthropic.com" },
          "4": { name: "Google", baseUrl: "https://generativelanguage.googleapis.com" },
          "5": { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
          "6": { name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1" },
          "7": { name: "Zhipu", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
        };
        
        const provider = providerMap[llmProvider];
        if (provider) {
          envConfig["LLM_PROVIDER"] = provider.name;
          
          const apiKey = await askQuestion(rl, `请输入 ${provider.name} API Key: `);
          if (apiKey.trim()) {
            envConfig["OPENAI_API_KEY"] = apiKey.trim();
          }
          
          const baseUrl = await askQuestion(rl, `请输入 API Base URL (直接回车使用默认: ${provider.baseUrl}): `);
          envConfig["OPENAI_BASE_URL"] = baseUrl.trim() || provider.baseUrl;
          
          const model = await askQuestion(rl, "请输入模型名称 (直接回车使用默认): ");
          if (model.trim()) {
            envConfig["LLM_MODEL"] = model.trim();
          }
        }
      }
    }
    
    // 图像 API 配置
    if (type === "all" || type === "image") {
      console.log("\n🎨 图像生成 API 配置");
      console.log("─────────────────────────────────────");
      
      console.log("\n📚 支持的图像服务商:");
      console.log("  1. OpenAI DALL-E");
      console.log("  2. Stability AI");
      console.log("  3. 通义万相 (阿里云)");
      console.log("  4. 文心一格 (百度)");
      
      const imageProvider = await askQuestion(rl, "\n请选择图像服务商 (1-4，直接回车跳过): ");
      
      if (imageProvider.trim()) {
        const apiKey = await askQuestion(rl, "请输入图像 API Key: ");
        if (apiKey.trim()) {
          envConfig["IMAGE_API_KEY"] = apiKey.trim();
        }
      }
    }
    
    // TTS API 配置
    if (type === "all" || type === "tts") {
      console.log("\n🔊 TTS (语音合成) API 配置");
      console.log("─────────────────────────────────────");
      
      console.log("\n📚 支持的 TTS 服务商:");
      console.log("  1. OpenAI TTS");
      console.log("  2. Azure TTS");
      console.log("  3. ElevenLabs");
      console.log("  4. 讯飞语音");
      console.log("  5. 阿里云语音");
      
      const ttsProvider = await askQuestion(rl, "\n请选择 TTS 服务商 (1-5，直接回车跳过): ");
      
      if (ttsProvider.trim()) {
        const apiKey = await askQuestion(rl, "请输入 TTS API Key: ");
        if (apiKey.trim()) {
          envConfig["TTS_API_KEY"] = apiKey.trim();
        }
      }
    }
    
    // 保存配置
    console.log("\n💾 保存配置...");
    
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }
    
    // 更新或添加配置项
    for (const [key, value] of Object.entries(envConfig)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log("✅ 配置已保存到 .env 文件");
    
    // 询问是否重启服务
    const restartConfirm = await askQuestion(rl, "\n🔄 是否重启服务以应用配置? (y/N): ");
    if (restartConfirm.toLowerCase() === "y") {
      restart(true, installPath);
    }
    
  } catch (error) {
    console.error("❌ 配置失败:", error);
  } finally {
    rl.close();
  }
}

/**
 * 进入容器 Shell
 */
export function shell(container: string = "app", installPath: string = getInstallPath()): void {
  console.log(`🐚 进入 FlintStudio ${container} 容器...`);
  
  if (!fs.existsSync(installPath)) {
    console.error(`❌ 安装目录不存在: ${installPath}`);
    return;
  }
  
  const containerMap: Record<string, string> = {
    app: "flintstudio-app-1",
    mysql: "flintstudio-mysql-1",
    redis: "flintstudio-redis-1",
  };
  
  const containerName = containerMap[container] || container;
  
  try {
    console.log(`📦 进入容器: ${containerName}`);
    console.log("💡 输入 'exit' 退出容器 Shell\n");
    execSync(`docker exec -it ${containerName} /bin/sh`, { cwd: installPath, stdio: "inherit" });
  } catch {
    // 尝试使用 bash
    try {
      execSync(`docker exec -it ${containerName} /bin/bash`, { cwd: installPath, stdio: "inherit" });
    } catch {
      console.error(`❌ 无法进入容器 ${containerName}`);
      console.log("💡 可用容器:");
      try {
        execSync("docker compose ps --services", { cwd: installPath, stdio: "inherit" });
      } catch {
        // 忽略
      }
    }
  }
}

/**
 * 清理 Docker 资源
 */
export function clean(all: boolean = false, dryRun: boolean = false, installPath: string = getInstallPath()): void {
  console.log(`${dryRun ? "🔍 [模拟运行]" : "🧹"} 清理 Docker 资源...\n`);
  
  const commands: string[] = [];
  
  // 基础清理
  console.log("📋 清理计划:");
  
  console.log("  1. 清理停止的容器");
  commands.push("docker container prune -f");
  
  console.log("  2. 清理未使用的镜像");
  commands.push("docker image prune -f");
  
  console.log("  3. 清理未使用的网络");
  commands.push("docker network prune -f");
  
  console.log("  4. 清理构建缓存");
  commands.push("docker builder prune -f");
  
  if (all) {
    console.log("  5. 清理所有未使用的卷 (⚠️ 危险)");
    commands.push("docker volume prune -f");
    
    console.log("  6. 深度系统清理");
    commands.push("docker system prune -af --volumes");
  }
  
  if (dryRun) {
    console.log("\n✅ 模拟运行完成，实际未执行任何操作");
    console.log("💡 移除 --dry-run 参数执行实际清理");
    return;
  }
  
  console.log("\n⏳ 开始清理...\n");
  
  for (const cmd of commands) {
    try {
      execSync(cmd, { stdio: "inherit" });
    } catch {
      console.log(`⚠️ 命令执行失败: ${cmd}`);
    }
  }
  
  console.log("\n✅ 清理完成");
  
  // 显示磁盘使用情况
  try {
    console.log("\n📊 当前 Docker 磁盘使用:");
    execSync("docker system df", { stdio: "inherit" });
  } catch {
    // 忽略
  }
}

/**
 * 系统诊断
 */
export function doctor(fix: boolean = false, full: boolean = false, installPath: string = getInstallPath()): void {
  console.log("🔍 FlintStudio 系统诊断\n");
  console.log("═══════════════════════════════════════\n");
  
  const issues: CheckResult[] = [];
  const fixes: (() => void)[] = [];
  
  // 1. 环境检查
  console.log("📋 1. 环境检查");
  console.log("─────────────────────────────────────");
  const envChecks = checkEnvironment();
  for (const check of envChecks) {
    console.log(`  ${check.message}`);
    if (!check.success && check.severity) {
      issues.push(check);
      if (check.fix) fixes.push(check.fix);
    }
  }
  
  // 2. 安装目录检查
  console.log("\n📋 2. 安装目录检查");
  console.log("─────────────────────────────────────");
  if (fs.existsSync(installPath)) {
    console.log(`  ✅ 安装目录存在: ${installPath}`);
    
    // 检查必要文件
    const requiredFiles = [".env", "docker-compose.yml"];
    for (const file of requiredFiles) {
      const filePath = path.join(installPath, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file} 存在`);
      } else {
        console.log(`  ❌ ${file} 缺失`);
        issues.push({
          success: false,
          message: `${file} 文件缺失`,
          severity: "error",
        });
      }
    }
  } else {
    console.log(`  ❌ 安装目录不存在: ${installPath}`);
    issues.push({
      success: false,
      message: "安装目录不存在",
      severity: "critical",
    });
  }
  
  // 3. 端口检查
  console.log("\n📋 3. 端口检查");
  console.log("─────────────────────────────────────");
  const portChecks = checkPorts();
  for (const check of portChecks) {
    console.log(`  ${check.message}`);
    if (!check.success) {
      issues.push(check);
    }
  }
  
  // 4. Docker 容器检查
  console.log("\n📋 4. Docker 容器检查");
  console.log("─────────────────────────────────────");
  if (fs.existsSync(installPath)) {
    try {
      execSync("docker compose ps", { cwd: installPath, stdio: "inherit" });
    } catch {
      console.log("  ❌ 无法获取容器状态");
    }
  }
  
  // 5. 磁盘空间检查
  console.log("\n📋 5. 磁盘空间检查");
  console.log("─────────────────────────────────────");
  try {
    if (os.platform() === "win32") {
      const output = execSync("wmic logicaldisk get size,freespace,caption", { encoding: "utf-8" });
      console.log(output);
    } else {
      execSync("df -h", { stdio: "inherit" });
    }
  } catch {
    console.log("  ⚠️ 无法获取磁盘信息");
  }
  
  // 6. 完整诊断额外检查
  if (full) {
    console.log("\n📋 6. 性能检查");
    console.log("─────────────────────────────────────");
    
    // 内存使用
    const totalMem = os.totalmem() / (1024 * 1024 * 1024);
    const freeMem = os.freemem() / (1024 * 1024 * 1024);
    const usedMem = totalMem - freeMem;
    const memPercent = (usedMem / totalMem) * 100;
    
    console.log(`  内存使用: ${usedMem.toFixed(1)}GB / ${totalMem.toFixed(1)}GB (${memPercent.toFixed(1)}%)`);
    if (memPercent > 90) {
      console.log("  ⚠️ 内存使用率过高");
      issues.push({
        success: false,
        message: "内存使用率过高",
        severity: "warning",
      });
    }
    
    // 检查日志大小
    console.log("\n📋 7. 日志文件检查");
    console.log("─────────────────────────────────────");
    try {
      const logOutput = execSync("docker system events --since 24h --until 0s 2>&1 | head -20", { encoding: "utf-8" });
      console.log("  最近 24 小时 Docker 事件:");
      console.log(logOutput || "  无异常事件");
    } catch {
      console.log("  ℹ️ 无法获取 Docker 事件");
    }
  }
  
  // 诊断总结
  console.log("\n═══════════════════════════════════════");
  console.log("📊 诊断总结");
  console.log("═══════════════════════════════════════");
  
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  
  if (issues.length === 0) {
    console.log("✅ 系统状态良好，未发现问题");
  } else {
    console.log(`发现问题: ${criticalCount} 个严重, ${errorCount} 个错误, ${warningCount} 个警告`);
    
    if (fix && fixes.length > 0) {
      console.log("\n🔧 尝试自动修复...");
      for (const fixFn of fixes) {
        try {
          fixFn();
        } catch (error) {
          console.error("  修复失败:", error);
        }
      }
    } else if (fixes.length > 0) {
      console.log("\n💡 使用 --fix 参数尝试自动修复");
    }
  }
}

/**
 * 端口管理
 */
export function port(action: string = "list", service: string = "", newPort: string = "", installPath: string = getInstallPath()): void {
  console.log(`🔌 端口管理 - ${action}\n`);
  
  const composePath = path.join(installPath, "docker-compose.yml");
  
  switch (action) {
    case "list":
      console.log("📋 当前端口配置:");
      console.log("─────────────────────────────────────");
      console.log("服务\t\t内部端口\t外部端口\t说明");
      console.log("─────────────────────────────────────");
      for (const mapping of DEFAULT_PORT_MAPPINGS) {
        console.log(`${mapping.service}\t\t${mapping.internal}\t\t${mapping.external}\t\t${mapping.description}`);
      }
      console.log("\n🌐 访问地址:");
      console.log(`  Web 界面: http://localhost:${DEFAULT_PORT_MAPPINGS[0].external}`);
      break;
      
    case "check":
      console.log("🔍 检查端口占用情况:");
      console.log("─────────────────────────────────────");
      const checks = checkPorts();
      for (const check of checks) {
        console.log(`  ${check.message}`);
      }
      break;
      
    case "change":
      if (!service || !newPort) {
        console.log("❌ 请提供服务和端口号");
        console.log("用法: port change <service> <new-port>");
        console.log("示例: port change app 8080");
        return;
      }
      
      if (!fs.existsSync(composePath)) {
        console.error(`❌ 未找到 docker-compose.yml: ${composePath}`);
        return;
      }
      
      const portNum = parseInt(newPort);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        console.error("❌ 无效的端口号");
        return;
      }
      
      console.log(`📝 修改 ${service} 服务端口为 ${portNum}...`);
      
      try {
        let composeContent = fs.readFileSync(composePath, "utf-8");
        
        // 根据服务类型修改端口映射
        const portPattern = new RegExp(`(${service}:.*?ports:.*?- \")\\d+(:\\d+\")`, "s");
        
        if (portPattern.test(composeContent)) {
          composeContent = composeContent.replace(portPattern, `$1${portNum}$2`);
          fs.writeFileSync(composePath, composeContent);
          console.log("✅ 端口配置已更新");
          console.log("⚠️  请重启服务以应用更改: openclaw run flintstudio-deploy restart");
        } else {
          console.log("⚠️ 未找到端口配置，请手动编辑 docker-compose.yml");
        }
      } catch (error) {
        console.error("❌ 修改失败:", error);
      }
      break;
      
    default:
      console.log("❌ 未知操作");
      console.log("可用操作: list, check, change");
  }
}

/**
 * 备份数据库
 */
export function backup(backupPath: string = path.join(os.homedir(), "flintstudio-backups"), auto: boolean = true, installPath: string = getInstallPath()): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = auto 
    ? path.join(backupPath, `flintstudio-backup-${timestamp}.sql`)
    : path.join(backupPath, "flintstudio-backup.sql");

  // 创建备份目录
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }

  console.log(`💾 备份数据库到 ${backupFile}...`);

  try {
    execSync(
      `docker exec flintstudio-mysql-1 mysqldump -uroot -pflintstudio flintstudio > "${backupFile}"`,
      { cwd: installPath, stdio: "pipe" }
    );
    console.log("✅ 备份完成");
    console.log(`📁 备份文件: ${backupFile}`);
  } catch {
    // 尝试替代方法
    try {
      execSync(
        `docker compose exec -T mysql mysqldump -uroot -pflintstudio flintstudio > "${backupFile}"`,
        { cwd: installPath, stdio: "pipe" }
      );
      console.log("✅ 备份完成");
      console.log(`📁 备份文件: ${backupFile}`);
    } catch (error) {
      console.error("❌ 备份失败:", error);
      console.log("💡 请确保 MySQL 容器正在运行");
    }
  }
}

/**
 * 恢复数据库
 */
export function restore(backupFile: string, force: boolean = false, installPath: string = getInstallPath()): void {
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ 备份文件不存在: ${backupFile}`);
    return;
  }
  
  if (!force) {
    console.log("⚠️ 警告: 恢复数据库将覆盖现有数据！");
    console.log("💡 使用 --force 参数跳过确认");
    return;
  }
  
  console.log(`📥 从 ${backupFile} 恢复数据库...`);
  
  try {
    execSync(
      `docker exec -i flintstudio-mysql-1 mysql -uroot -pflintstudio flintstudio < "${backupFile}"`,
      { cwd: installPath, stdio: "inherit" }
    );
    console.log("✅ 恢复完成");
  } catch {
    // 尝试替代方法
    try {
      execSync(
        `docker compose exec -T mysql mysql -uroot -pflintstudio flintstudio < "${backupFile}"`,
        { cwd: installPath, stdio: "inherit" }
      );
      console.log("✅ 恢复完成");
    } catch (error) {
      console.error("❌ 恢复失败:", error);
    }
  }
}

/**
 * 重置数据（危险操作）
 */
export function reset(confirm: string, keepImages: boolean = true, installPath: string = getInstallPath()): void {
  if (confirm !== "yes") {
    console.log("⚠️  请输入 'yes' 确认重置操作");
    console.log("💡 这将删除所有数据，包括数据库和上传的文件！");
    return;
  }

  console.log("🗑️  正在重置所有数据...");
  
  if (!fs.existsSync(installPath)) {
    console.error(`❌ 安装目录不存在: ${installPath}`);
    return;
  }
  
  try {
    // 停止并删除容器和卷
    execSync("docker compose down -v", { cwd: installPath, stdio: "inherit" });
    
    if (!keepImages) {
      console.log("  🧹 删除 Docker 镜像...");
      execSync("docker compose down --rmi all", { cwd: installPath, stdio: "ignore" });
    }
    
    console.log("✅ 数据已重置");
    console.log("💡 下次启动将重新初始化");
  } catch (error) {
    console.error("❌ 重置失败:", error);
  }
}

// 命令行入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const subCommand = args[1];
  const subCommand2 = args[2];

  switch (command) {
    case "deploy":
      const deployOptions: DeployOptions = {};
      if (args.includes("--mirror=cn")) deployOptions.mirror = "cn";
      if (args.includes("--mirror=global")) deployOptions.mirror = "global";
      deploy(deployOptions).catch(console.error);
      break;
      
    case "start":
      start(subCommand);
      break;
      
    case "stop":
      stop(subCommand);
      break;
      
    case "restart":
      restart(args.includes("--quick") || args.includes("-q"), subCommand);
      break;
      
    case "update":
      update(args.includes("--force") || args.includes("-f"), subCommand);
      break;
      
    case "logs":
      const lines = args.find(a => a.startsWith("--lines="));
      logs(subCommand, lines ? parseInt(lines.split("=")[1]) : 100);
      break;
      
    case "status":
      status(args.includes("--verbose") || args.includes("-v"), subCommand);
      break;
      
    case "config":
      const configType = args.find(a => a.startsWith("--type="))?.split("=")[1];
      config(configType || "all", args.includes("--show"), subCommand);
      break;
      
    case "shell":
      shell(subCommand || "app");
      break;
      
    case "clean":
      clean(
        args.includes("--all") || args.includes("-a"),
        args.includes("--dry-run")
      );
      break;
      
    case "doctor":
      doctor(
        args.includes("--fix") || args.includes("-f"),
        args.includes("--full")
      );
      break;
      
    case "port":
      port(
        subCommand || "list",
        subCommand2 || "",
        args.find(a => a.startsWith("--new-port="))?.split("=")[1] || ""
      );
      break;
      
    case "backup":
      backup(subCommand, !args.includes("--no-auto"));
      break;
      
    case "restore":
      restore(subCommand || "", args.includes("--force"));
      break;
      
    case "reset":
      reset(subCommand, !args.includes("--no-keep-images"));
      break;
      
    default:
      console.log("🎬 FlintStudio Deploy Skill v1.1.0");
      console.log("=====================================\n");
      console.log("Usage: ts-node deploy.ts <command> [options]\n");
      console.log("Commands:");
      console.log("  deploy [path]       完整部署");
      console.log("  start [path]        启动服务");
      console.log("  stop [path]         停止服务");
      console.log("  restart [path]      重启服务 (--quick 快速重启)");
      console.log("  update [path]       更新版本 (--force 强制更新)");
      console.log("  logs [svc]          查看日志 (--lines=N)");
      console.log("  status [path]       检查状态 (--verbose)");
      console.log("  config [type]       配置 API (--show 显示配置)");
      console.log("  shell [container]   进入容器 Shell");
      console.log("  clean               清理 Docker (--all 深度清理)");
      console.log("  doctor              系统诊断 (--fix 自动修复, --full 完整诊断)");
      console.log("  port [action]       端口管理 (list/check/change)");
      console.log("  backup [path]       备份数据");
      console.log("  restore <file>      恢复备份 (--force)");
      console.log("  reset yes           重置数据");
      console.log("\nExamples:");
      console.log("  ts-node deploy.ts deploy");
      console.log("  ts-node deploy.ts config --type=llm");
      console.log("  ts-node deploy.ts doctor --fix");
      console.log("  ts-node deploy.ts port change app 8080");
  }
}
