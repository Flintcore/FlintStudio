import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    const body = await request.json().catch(() => ({}));
    const name = body.name?.trim() || `项目 ${new Date().toLocaleDateString("zh-CN")}`;
    const project = await prisma.project.create({
      data: {
        name,
        userId: session.user.id,
      },
    });
    await prisma.novelPromotionProject.create({
      data: { projectId: project.id },
    });
    return NextResponse.json({ id: project.id, name: project.name }, { status: 201 });
  } catch (e) {
    console.error("[projects/create]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "创建项目失败" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
