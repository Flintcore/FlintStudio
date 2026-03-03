import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const EPISODES_DIR = path.join(DATA_DIR, "episodes");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params;
  if (!episodeId || episodeId.includes("..")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const filePath = path.join(EPISODES_DIR, `${episodeId}.mp4`);
    const buf = await readFile(filePath);
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
