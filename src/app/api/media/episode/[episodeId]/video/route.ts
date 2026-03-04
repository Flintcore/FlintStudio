import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { env } from "@/lib/env";

const DATA_DIR = env.DATA_DIR || path.join(process.cwd(), "data");
const EPISODES_DIR = path.join(DATA_DIR, "episodes");

// 验证 ID 格式（只允许 UUID 格式或安全的字符串）
function isValidEpisodeId(id: string): boolean {
  // UUID 格式或只包含字母数字下划线
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params;
  if (!episodeId || !isValidEpisodeId(episodeId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const filePath = path.join(EPISODES_DIR, `${episodeId}.mp4`);
    // 确保解析后的路径在允许的目录内
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(EPISODES_DIR);
    if (!resolvedPath.startsWith(resolvedDir)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const buf = await readFile(resolvedPath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
