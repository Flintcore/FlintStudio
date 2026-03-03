import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password || username.length < 2) {
      return NextResponse.json(
        { error: "用户名至少 2 个字符，且需提供密码" },
        { status: 400 }
      );
    }
    const existing = await prisma.user.findUnique({ where: { name: username } });
    if (existing) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
    }
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name: username, password: hashed },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
