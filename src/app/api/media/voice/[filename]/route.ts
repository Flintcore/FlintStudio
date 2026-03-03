import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const VOICE_DIR = path.join(DATA_DIR, "voice");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!filename || filename.includes("..")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const filePath = path.join(VOICE_DIR, filename);
    const buf = await readFile(filePath);
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
