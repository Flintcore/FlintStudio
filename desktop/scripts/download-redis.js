/**
 * 下载 Redis Windows 便携版到 desktop/resources/redis/，供内嵌打包使用。
 * 使用 tporadowski/redis 官方 Windows 构建。
 */

const path = require("path");
const fs = require("fs");
const https = require("https");

const REDIS_ZIP_URL = "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip";
const resourcesDir = path.join(__dirname, "..", "resources");
const redisDir = path.join(resourcesDir, "redis");
const zipPath = path.join(resourcesDir, "redis-temp.zip");

if (process.platform !== "win32") {
  console.log("当前非 Windows，跳过 Redis 下载。Windows 打包时请在 Windows 下执行 npm run build。");
  process.exit(0);
}

if (fs.existsSync(path.join(redisDir, "redis-server.exe"))) {
  console.log("已存在 resources/redis/redis-server.exe，跳过下载。");
  process.exit(0);
}

fs.mkdirSync(redisDir, { recursive: true });

function download(url) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(zipPath);
    https.get(url, { redirect: "follow" }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败: ${res.statusCode} ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlink(zipPath, () => {});
      reject(err);
    });
  });
}

function unzip(zipPath, outDir) {
  const AdmZip = require("adm-zip");
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(outDir, true);
}

(async () => {
  try {
    console.log("正在下载 Redis Windows 便携版...");
    await download(REDIS_ZIP_URL);
    console.log("正在解压到 resources/redis/ ...");
    unzip(zipPath, redisDir);
    fs.unlinkSync(zipPath);
    let exe = path.join(redisDir, "redis-server.exe");
    if (!fs.existsSync(exe)) {
      const entries = fs.readdirSync(redisDir, { withFileTypes: true });
      const sub = entries.find((e) => e.isDirectory());
      if (sub) {
        const subPath = path.join(redisDir, sub.name);
        exe = path.join(subPath, "redis-server.exe");
        if (fs.existsSync(exe)) {
          const files = fs.readdirSync(subPath);
          for (const f of files) {
            fs.renameSync(path.join(subPath, f), path.join(redisDir, f));
          }
          fs.rmSync(subPath, { recursive: true });
        }
      }
    }
    exe = path.join(redisDir, "redis-server.exe");
    if (fs.existsSync(exe)) {
      console.log("Redis 已就绪: resources/redis/redis-server.exe");
    } else {
      console.warn("解压后未找到 redis-server.exe，请检查 zip 结构。");
    }
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
})();
