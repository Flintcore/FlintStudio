import { exec } from "child_process";
import { mkdir, writeFile, readFile, unlink, rmdir } from "fs/promises";
import path from "path";
import { promisify } from "util";
import { env } from "@/lib/env";

const execAsync = promisify(exec);
const DATA_DIR = env.DATA_DIR || path.join(process.cwd(), "data");
const VOICE_DIR = path.join(DATA_DIR, "voice");

/**
 * 转义 shell 参数，防止命令注入
 * 使用单引号包裹，并将单引号替换为 '\''
 */
function escapeShellArg(arg: string): string {
  // 只允许安全的字符
  if (!/^[a-zA-Z0-9_\-/.:@]+$/.test(arg)) {
    // 包含特殊字符，使用更严格的转义
    return "'" + arg.replace(/'/g, "'\"'\"'") + "'";
  }
  return arg;
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

async function downloadToTemp(url: string, filepath: string): Promise<void> {
  const base = env.NEXTAUTH_URL || "http://localhost:3000";
  const fullUrl = url.startsWith("http") ? url : `${base}${url}`;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`下载失败: ${fullUrl} ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(filepath, buf);
}

/** 将分镜图 + 配音按顺序合成为一集视频，输出到 data/episodes/{episodeId}.mp4 */
export async function composeEpisodeVideo(opts: {
  episodeId: string;
  segments: Array<{ imageUrl: string | null; audioPath: string }>;
}): Promise<{ videoPath: string }> {
  const { episodeId, segments } = opts;
  const outDir = path.join(DATA_DIR, "episodes");
  const workDir = path.join(outDir, `work_${episodeId}`);
  await mkdir(workDir, { recursive: true });

  const segmentVideos: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const imagePath = path.join(workDir, `img_${i}.png`);
    if (seg.imageUrl) {
      await downloadToTemp(seg.imageUrl, imagePath);
    } else {
      await createPlaceholderImage(imagePath);
    }
    const duration = await getAudioDurationSeconds(seg.audioPath);
    const segOut = path.join(workDir, `seg_${i}.mp4`);
    
    // 使用转义后的路径
    const safeImagePath = escapeShellArg(imagePath);
    const safeAudioPath = escapeShellArg(seg.audioPath);
    const safeSegOut = escapeShellArg(segOut);
    
    await execAsync(
      `ffmpeg -y -loop 1 -i ${safeImagePath} -i ${safeAudioPath} -c:v libx264 -tune stillimage -c:a aac -shortest -pix_fmt yuv420p -r 24 -t ${Math.max(0.5, duration)} ${safeSegOut}`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    segmentVideos.push(segOut);
  }

  const listPath = path.join(workDir, "list.txt");
  const listContent = segmentVideos
    .map((p) => `file ${escapeShellArg(p).replace(/^'|'$/g, "")}`)
    .join("\n");
  await writeFile(listPath, listContent);

  const outputPath = path.join(outDir, `${episodeId}.mp4`);
  await execAsync(
    `ffmpeg -y -f concat -safe 0 -i ${escapeShellArg(listPath)} -c copy ${escapeShellArg(outputPath)}`,
    { maxBuffer: 10 * 1024 * 1024 }
  );

  // 清理临时文件
  for (const p of segmentVideos) {
    try {
      await unlink(p);
    } catch {
      // ignore
    }
  }
  try {
    await unlink(listPath);
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

  // 清理工作目录
  try {
    await rmdir(workDir);
  } catch {
    // 目录可能非空，忽略错误
  }

  return { videoPath: outputPath };
}

async function createPlaceholderImage(filepath: string): Promise<void> {
  await execAsync(
    `ffmpeg -y -f lavfi -i color=c=black:s=1024x1024:d=1 -frames:v 1 ${escapeShellArg(filepath)}`,
    { maxBuffer: 5 * 1024 * 1024 }
  );
}
