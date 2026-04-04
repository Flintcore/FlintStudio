import { exec } from "child_process";
import { createWriteStream } from "fs";
import { mkdir, writeFile, unlink, rm } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable, Transform } from "stream";
import { promisify } from "util";
import { env } from "@/lib/env";

const execAsync = promisify(exec);
const DATA_DIR = env.DATA_DIR || path.join(process.cwd(), "data");

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function validateEpisodeId(episodeId: string): void {
  if (!episodeId || !UUID_REGEX.test(episodeId)) {
    throw new Error(`episodeId 格式无效，必须为 UUID 格式`);
  }
}

/**
 * 转义 shell 参数，防止命令注入
 * 始终用单引号包裹，内部单引号替换为 '\''（结束引号 + 转义单引号 + 重开引号）
 */
function escapeShellArg(arg: string): string {
  return "'" + String(arg).replace(/'/g, "'\\''") + "'";
}

async function getAudioDurationSeconds(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${escapeShellArg(audioPath)}`,
      { maxBuffer: 1024 * 1024 }
    );
    const d = parseFloat(stdout.trim());
    return Number.isFinite(d) && d > 0 ? d : 3;
  } catch {
    return 3;
  }
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT_MS = 60000;

/** 校验图片 URL，仅允许 http/https，禁止 localhost、内网 IP，防止 SSRF */
function validateImageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`无效的图片 URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`仅允许 http/https 协议: ${url}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  ) {
    throw new Error(`不允许访问本地地址: ${url}`);
  }
  // 内网 IP
  if (/^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\./i.test(host)) {
    throw new Error(`不允许访问内网地址: ${url}`);
  }
}

async function downloadToTemp(url: string, filepath: string): Promise<void> {
  // 处理 data: URL（由图像 API 返回 b64_json 时生成）
  if (url.startsWith("data:")) {
    const commaIndex = url.indexOf(",");
    if (commaIndex === -1) throw new Error(`无效的 data URL: ${url.slice(0, 50)}`);
    const base64Data = url.slice(commaIndex + 1);
    await writeFile(filepath, Buffer.from(base64Data, "base64"));
    return;
  }

  const base = env.NEXTAUTH_URL || "http://localhost:3000";
  const fullUrl = url.startsWith("http") ? url : `${base}${url}`;
  validateImageUrl(fullUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const res = await fetch(fullUrl, { signal: controller.signal });
  clearTimeout(timeoutId);
  if (!res.ok) throw new Error(`下载失败: ${fullUrl} ${res.status}`);

  const contentLength = res.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!Number.isFinite(size) || size > MAX_IMAGE_SIZE) {
      throw new Error(`响应体过大 (${contentLength})，超过限制 ${MAX_IMAGE_SIZE} bytes`);
    }
  }

  const nodeReadable = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  let written = 0;
  const limitedStream = nodeReadable.pipe(
    new Transform({
      transform(chunk: Buffer, _enc, cb) {
        written += chunk.length;
        if (written > MAX_IMAGE_SIZE) {
          cb(new Error("响应体超过大小限制"));
          return;
        }
        cb(null, chunk);
      },
    })
  );
  await pipeline(limitedStream, createWriteStream(filepath));
}

/** 将分镜图 + 配音按顺序合成为一集视频，输出到 data/episodes/{episodeId}.mp4 */
export async function composeEpisodeVideo(opts: {
  episodeId: string;
  segments: Array<{ imageUrl: string | null; audioPath: string }>;
}): Promise<{ videoPath: string }> {
  const { episodeId, segments } = opts;
  validateEpisodeId(episodeId);
  const outDir = path.resolve(DATA_DIR, "episodes");
  const workDir = path.join(outDir, `work_${episodeId}`);
  const outputPath = path.join(outDir, `${episodeId}.mp4`);
  const resolvedOutput = path.resolve(outputPath);
  if (!resolvedOutput.startsWith(outDir + path.sep) && resolvedOutput !== outDir) {
    throw new Error(`outputPath 路径逃逸检测: ${resolvedOutput}`);
  }
  await mkdir(workDir, { recursive: true });

  const segmentVideos: string[] = [];

  try {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const imagePath = path.join(workDir, `img_${i}.png`);
      try {
        if (seg.imageUrl) {
          await downloadToTemp(seg.imageUrl, imagePath);
        } else {
          await createPlaceholderImage(imagePath);
        }
        const duration = await getAudioDurationSeconds(seg.audioPath);
        const segOut = path.join(workDir, `seg_${i}.mp4`);

        const safeImagePath = escapeShellArg(imagePath);
        const safeAudioPath = escapeShellArg(seg.audioPath);
        const safeSegOut = escapeShellArg(segOut);
        const safeDuration = escapeShellArg(String(Math.max(0.5, duration)));

        await execAsync(
          `ffmpeg -y -loop 1 -i ${safeImagePath} -i ${safeAudioPath} -c:v libx264 -tune stillimage -c:a aac -shortest -pix_fmt yuv420p -r 24 -t ${safeDuration} ${safeSegOut}`,
          { maxBuffer: 10 * 1024 * 1024 }
        );
        segmentVideos.push(segOut);
      } catch (e) {
        // 单次循环异常时尝试清理已创建的临时文件
        try {
          await unlink(path.join(workDir, `seg_${i}.mp4`));
        } catch {
          /* ignore */
        }
        try {
          await unlink(path.join(workDir, `img_${i}.png`));
        } catch {
          /* ignore */
        }
        throw e;
      }
    }

    const listPath = path.join(workDir, "list.txt");
    const listContent = segmentVideos
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listPath, listContent);

    await execAsync(
      `ffmpeg -y -f concat -safe 0 -i ${escapeShellArg(listPath)} -c copy ${escapeShellArg(outputPath)}`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    return { videoPath: outputPath };
  } finally {
    // 清理临时文件及工作目录
    for (const p of segmentVideos) {
      try {
        await unlink(p);
      } catch {
        // ignore
      }
    }
    try {
      await unlink(path.join(workDir, "list.txt"));
    } catch {
      // ignore
    }
    for (let i = 0; i < segments.length; i++) {
      try {
        await unlink(path.join(workDir, `img_${i}.png`));
      } catch {
        // ignore
      }
    }
    try {
      await rm(workDir, { recursive: true });
    } catch {
      // ignore
    }
  }
}

async function createPlaceholderImage(filepath: string): Promise<void> {
  await execAsync(
    `ffmpeg -y -f lavfi -i color=c=black:s=1024x1024:d=1 -frames:v 1 ${escapeShellArg(filepath)}`,
    { maxBuffer: 5 * 1024 * 1024 }
  );
}
