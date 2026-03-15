/**
 * 从项目根目录复制 Next.js standalone 与完整应用（供 Worker）到 desktop/resources。
 * 前置：在项目根目录执行 npm run build。
 */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "../..");
const resourcesDir = path.join(__dirname, "..", "resources");
const standaloneSrc = path.join(rootDir, ".next", "standalone");
const standaloneDest = path.join(resourcesDir, "standalone");
const appDest = path.join(resourcesDir, "app");

const excludeFromApp = new Set([".next", "node_modules", ".git", "data", "release", "desktop", ".env", ".env.local"]);

if (!fs.existsSync(standaloneSrc)) {
  console.error("未找到 .next/standalone，请先在项目根目录执行: npm run build");
  process.exit(1);
}

fs.mkdirSync(resourcesDir, { recursive: true });
fs.mkdirSync(path.join(resourcesDir, "redis"), { recursive: true });

function copyDir(src, dest, exclude) {
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    if (exclude && exclude.has(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d, exclude);
    else fs.copyFileSync(s, d);
  }
}

console.log("复制 .next/standalone -> desktop/resources/standalone ...");
copyDir(standaloneSrc, standaloneDest);

console.log("复制应用代码 -> desktop/resources/app（供 Worker）...");
copyDir(rootDir, appDest, excludeFromApp);

console.log("在 resources/app 安装依赖（含 tsx）...");
execSync("npm install --omit=dev", { cwd: appDest, stdio: "inherit" });
execSync("npm install tsx", { cwd: appDest, stdio: "inherit" });
console.log("生成 Prisma Client...");
execSync("npx prisma generate", { cwd: appDest, stdio: "inherit" });

console.log("desktop/resources 准备完成。");
console.log("可选：将 Redis Windows 便携版 redis-server.exe 放入 desktop/resources/redis/ 以便桌面版内置启动。");
