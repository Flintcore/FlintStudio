import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }
  const name = `项目 ${new Date().toLocaleDateString("zh-CN")}`;
  const project = await prisma.project.create({
    data: {
      name,
      userId: session.user.id,
    },
  });
  const np = await prisma.novelPromotionProject.create({
    data: { projectId: project.id },
  });
  return NextResponse.redirect(new URL(`/workspace/${project.id}`, process.env.NEXTAUTH_URL || "http://localhost:3000"));
}
