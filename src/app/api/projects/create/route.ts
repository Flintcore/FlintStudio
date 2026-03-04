import { getCurrentSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    const name = `项目 ${new Date().toLocaleDateString("zh-CN")}`;
    const project = await prisma.project.create({
      data: {
        name,
        userId: session.user.id,
      },
    });
    await prisma.novelPromotionProject.create({
      data: { projectId: project.id },
    });
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(new URL(`/workspace/${project.id}`, origin));
  } catch (e) {
    console.error("[projects/create]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "创建项目失败" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
