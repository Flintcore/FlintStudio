/**
 * FlintStudio 桌面版 - Electron 主进程
 * 一键启动：Redis（可选内嵌）→ 检测 MySQL → Next.js + Worker → 打开 Web UI
 */

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";

const isDev = process.env.NODE_ENV !== "production";
const DEFAULT_PORT = 3000;
const REDIS_PORT = 6379;
const MYSQL_PORT = 3306;

let mainWindow: BrowserWindow | null = null;
let nextProcess: ChildProcess | null = null;
let workerProcess: ChildProcess | null = null;
let redisProcess: ChildProcess | null = null;

/** 应用数据目录（存储配置、数据等） */
function getAppDataDir(): string {
  const base = process.platform === "win32" ? process.env.APPDATA || path.join(process.env.USERPROFILE!, "AppData", "Roaming") : path.join(process.env.HOME!, ".config");
  return path.join(base, "FlintStudio");
}

/** 配置文件路径 */
function getConfigPath(): string {
  return path.join(getAppDataDir(), "config.json");
}

/** 资源路径（打包后为 process.resourcesPath；开发时为 desktop/resources） */
function getResourcesDir(): string {
  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, "standalone"))) {
    return process.resourcesPath;
  }
  return path.join(app.getAppPath(), "resources");
}

/** 生成简单随机字符串 */
function randomSecret(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** 读取配置（首次无文件则写入默认并返回） */
function loadConfig(): Record<string, string> {
  const configPath = getConfigPath();
  try {
    const data = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(data);
  } catch {
    const defaults: Record<string, string> = {
      PORT: String(DEFAULT_PORT),
      DATABASE_URL: "mysql://root:flintstudio@127.0.0.1:3306/flintstudio",
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: "6379",
      NEXTAUTH_SECRET: randomSecret(32),
      INTERNAL_TASK_TOKEN: randomSecret(24),
    };
    saveConfig(defaults);
    return defaults;
  }
}

/** 保存配置 */
function saveConfig(config: Record<string, string>): void {
  const dir = getAppDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

/** 检测端口是否可连接 */
function checkPort(port: number, host: string = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 2000);
    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    socket.connect(port, host);
  });
}

/** 尝试启动内嵌 Redis（若存在） */
async function tryStartEmbeddedRedis(): Promise<boolean> {
  const resources = getResourcesDir();
  const redisExe = path.join(resources, "redis", "redis-server.exe");
  if (process.platform !== "win32" || !fs.existsSync(redisExe)) {
    return false;
  }
  return new Promise((resolve) => {
    redisProcess = spawn(redisExe, ["--port", String(REDIS_PORT)], {
      cwd: path.dirname(redisExe),
      stdio: "ignore",
      detached: true,
    });
    redisProcess.unref();
    setTimeout(async () => {
      const ok = await checkPort(REDIS_PORT);
      resolve(ok);
    }, 1500);
  });
}

/** 首次运行向导：检测 MySQL/Redis，必要时提示用户 */
async function ensureDependencies(): Promise<{ ok: boolean; message: string }> {
  let redisOk = await checkPort(REDIS_PORT);
  if (!redisOk) {
    redisOk = await tryStartEmbeddedRedis();
  }
  if (!redisOk) {
    return {
      ok: false,
      message: "Redis 未运行。请安装 Redis 并启动，或将 Redis 便携版放入安装目录的 resources/redis 下。\n\n详见桌面版 README。",
    };
  }

  const mysqlOk = await checkPort(MYSQL_PORT);
  if (!mysqlOk) {
    return {
      ok: false,
      message: "MySQL 未运行。请先安装 MySQL 并启动在 localhost:3306，或使用项目根目录的 docker-compose.desktop.yml 启动（需已安装 Docker）。\n\n启动后请重新打开 FlintStudio。",
    };
  }

  return { ok: true, message: "" };
}

/** 启动 Next.js 独立服务 */
function startNextServer(port: number): Promise<void> {
  const resources = getResourcesDir();
  const standaloneDir = path.join(resources, "standalone");
  const serverJs = path.join(standaloneDir, "server.js");

  if (!fs.existsSync(serverJs)) {
    return Promise.reject(new Error("未找到 Next 独立服务，请先在项目根目录执行 npm run build，再在 desktop 目录执行 npm run build。"));
  }

  const config = loadConfig();
  const dataDir = path.join(getAppDataDir(), "data");
  const env: Record<string, string> = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    DATA_DIR: config.DATA_DIR || dataDir,
    NEXTAUTH_SECRET: config.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET || randomSecret(32),
    INTERNAL_TASK_TOKEN: config.INTERNAL_TASK_TOKEN || process.env.INTERNAL_TASK_TOKEN || randomSecret(24),
  };
  return new Promise((resolve, reject) => {
    nextProcess = spawn(process.execPath, [serverJs], {
      cwd: standaloneDir,
      env,
      stdio: "pipe",
    });
    nextProcess.stdout?.on("data", (d) => process.stdout.write(d.toString()));
    nextProcess.stderr?.on("data", (d) => process.stderr.write(d.toString()));
    nextProcess.on("error", reject);
    nextProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) reject(new Error(`Next 进程退出: ${code}`));
    });
    setTimeout(resolve, 3000);
  });
}

/** 启动 Worker（从 resources/app 用 tsx 运行） */
function startWorker(port: number): Promise<void> {
  const resources = getResourcesDir();
  const appDir = path.join(resources, "app");
  const workerEntry = path.join(appDir, "src", "lib", "workers", "index.ts");
  const tsxCli = path.join(appDir, "node_modules", "tsx", "dist", "cli.js");

  if (!fs.existsSync(workerEntry)) {
    return Promise.reject(new Error("未找到 Worker 入口，请先在 desktop 目录执行 npm run build（会复制并安装 resources/app）。"));
  }
  if (!fs.existsSync(tsxCli)) {
    return Promise.reject(new Error("未找到 tsx，请在 desktop 目录重新执行 npm run build。"));
  }

  const config = loadConfig();
  const dataDir = path.join(getAppDataDir(), "data");
  const env: Record<string, string> = {
    ...process.env,
    NEXTAUTH_URL: `http://127.0.0.1:${port}`,
    DATABASE_URL: config.DATABASE_URL || "mysql://root:flintstudio@127.0.0.1:3306/flintstudio",
    REDIS_HOST: config.REDIS_HOST || "127.0.0.1",
    REDIS_PORT: config.REDIS_PORT || "6379",
    DATA_DIR: config.DATA_DIR || dataDir,
    NEXTAUTH_SECRET: config.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET || randomSecret(32),
    INTERNAL_TASK_TOKEN: config.INTERNAL_TASK_TOKEN || process.env.INTERNAL_TASK_TOKEN || randomSecret(24),
  };

  return new Promise((resolve, reject) => {
    workerProcess = spawn(process.execPath, [tsxCli, workerEntry], {
      cwd: appDir,
      env,
      stdio: "pipe",
    });
    workerProcess.stdout?.on("data", (d) => process.stdout.write(d.toString()));
    workerProcess.stderr?.on("data", (d) => process.stderr.write(d.toString()));
    workerProcess.on("error", reject);
    workerProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) reject(new Error(`Worker 进程退出: ${code}`));
    });
    setTimeout(resolve, 2000);
  });
}

/** 创建主窗口 */
function createMainWindow(port: number): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "FlintStudio",
    show: false,
  });

  const url = `http://127.0.0.1:${port}`;
  mainWindow.loadURL(url);
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

/** 退出时清理子进程 */
function killChildren(): void {
  if (nextProcess) {
    nextProcess.kill("SIGTERM");
    nextProcess = null;
  }
  if (workerProcess) {
    workerProcess.kill("SIGTERM");
    workerProcess = null;
  }
  if (redisProcess) {
    redisProcess.kill("SIGTERM");
    redisProcess = null;
  }
}

app.whenReady().then(async () => {
  const config = loadConfig();
  const port = parseInt(config.PORT || String(DEFAULT_PORT), 10) || DEFAULT_PORT;

  const deps = await ensureDependencies();
  if (!deps.ok) {
    dialog.showMessageBoxSync({
      type: "warning",
      title: "FlintStudio 桌面版",
      message: "依赖未就绪",
      detail: deps.message,
    });
    app.quit();
    return;
  }

  try {
    await startNextServer(port);
    await startWorker(port);
    createMainWindow(port);
  } catch (e) {
    dialog.showMessageBoxSync({
      type: "error",
      title: "FlintStudio 桌面版",
      message: "启动失败",
      detail: (e as Error).message,
    });
    app.quit();
  }
});

app.on("window-all-closed", () => {
  killChildren();
  app.quit();
});

app.on("before-quit", () => killChildren());

ipcMain.handle("get-config", () => loadConfig());
ipcMain.handle("save-config", (_e, config: Record<string, string>) => {
  saveConfig(config);
});
