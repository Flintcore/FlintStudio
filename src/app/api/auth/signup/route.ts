import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// 密码最小长度
const MIN_PASSWORD_LENGTH = 6;
// 用户名最大长度
const MAX_USERNAME_LENGTH = 32;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (body == null) {
      return NextResponse.json(
        { error: "请求体不是有效的 JSON" },
        { status: 400 }
      );
    }
    const { username, password } = body;
    
    // 验证用户名
    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "请提供用户名" },
        { status: 400 }
      );
    }
    
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 2) {
      return NextResponse.json(
        { error: "用户名至少 2 个字符" },
        { status: 400 }
      );
    }
    if (trimmedUsername.length > MAX_USERNAME_LENGTH) {
      return NextResponse.json(
        { error: `用户名最多 ${MAX_USERNAME_LENGTH} 个字符` },
        { status: 400 }
      );
    }
    
    // 验证用户名格式（只允许字母、数字、中文、下划线）
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: "用户名只能包含字母、数字、中文和下划线" },
        { status: 400 }
      );
    }
    
    // 验证密码
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "请提供密码" },
        { status: 400 }
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `密码至少 ${MIN_PASSWORD_LENGTH} 个字符` },
        { status: 400 }
      );
    }
    const existing = await prisma.user.findUnique({ where: { name: trimmedUsername } });
    if (existing) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
    }
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name: trimmedUsername, password: hashed },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[signup]", e);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
