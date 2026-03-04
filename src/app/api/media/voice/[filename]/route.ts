import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { env } from "@/lib/env";

const DATA_DIR = env.DATA_DIR || path.join(process.cwd(), "data");
const VOICE_DIR = path.join(DATA_DIR, "voice");

// 验证文件名（只允许安全的字符）
function isValidFilename(filename: string): boolean {
  // 只允许字母数字、下划线、点和连字符，且不能包含 .. 
  return /^[a-zA-Z0-9_.-]+$/.test(filename) && !filename.includes("..");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!filename || !isValidFilename(filename)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const filePath = path.join(VOICE_DIR, filename);
    // 确保解析后的路径在允许的目录内
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(VOICE_DIR);
    if (!resolvedPath.startsWith(resolvedDir)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const buf = await readFile(resolvedPath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "audio/mpeg",
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
