/**
 * 全局搜索 API
 * 支持项目、剧集、角色、场景搜索
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({
        projects: [],
        episodes: [],
        characters: [],
        locations: [],
      });
    }

    const userId = session.user.id;

    // 并行搜索
    // MySQL 不区分大小写，不需要 mode: "insensitive"
    const [projects, episodes, characters, locations] = await Promise.all([
      // 搜索项目
      prisma.project.findMany({
        where: {
          userId,
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          description: true,
          mode: true,
          updatedAt: true,
        },
      }),

      // 搜索剧集
      prisma.novelPromotionEpisode.findMany({
        where: {
          novelPromotionProject: {
            project: { userId },
          },
          OR: [
            { name: { contains: query } },
            { novelText: { contains: query } },
          ],
        },
        take: 10,
        select: {
          id: true,
          episodeNumber: true,
          name: true,
          novelPromotionProject: {
            select: {
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),

      // 搜索角色
      prisma.novelPromotionCharacter.findMany({
        where: {
          novelPromotionProject: {
            project: { userId },
          },
          OR: [
            { name: { contains: query } },
            { aliases: { contains: query } },
          ],
        },
        take: 10,
        select: {
          id: true,
          name: true,
          voiceId: true,
          novelPromotionProject: {
            select: {
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),

      // 搜索场景
      prisma.novelPromotionLocation.findMany({
        where: {
          novelPromotionProject: {
            project: { userId },
          },
          OR: [
            { name: { contains: query } },
            { summary: { contains: query } },
          ],
        },
        take: 10,
        select: {
          id: true,
          name: true,
          summary: true,
          novelPromotionProject: {
            select: {
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        type: "project" as const,
        url: `/workspace/${p.id}`,
        updatedAt: p.updatedAt,
      })),
      episodes: episodes.map((e) => ({
        id: e.id,
        name: e.name || `第 ${e.episodeNumber} 集`,
        episodeNumber: e.episodeNumber,
        type: "episode" as const,
        url: `/workspace/${e.novelPromotionProject.project.id}/episode/${e.id}`,
        projectName: e.novelPromotionProject.project.name,
      })),
      characters: characters.map((c) => ({
        id: c.id,
        name: c.name,
        type: "character" as const,
        url: `/workspace/${c.novelPromotionProject.project.id}`,
        projectName: c.novelPromotionProject.project.name,
        hasVoice: !!c.voiceId,
      })),
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        type: "location" as const,
        summary: l.summary,
        url: `/workspace/${l.novelPromotionProject.project.id}`,
        projectName: l.novelPromotionProject.project.name,
      })),
    });
  } catch (error) {
    console.error("[search]", error);
    return NextResponse.json(
      { error: "搜索失败" },
      { status: 500 }
    );
  }
}
