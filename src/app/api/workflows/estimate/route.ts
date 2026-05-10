/**
 * 工作流成本预估 API
 * POST /api/workflows/estimate
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { estimateWorkflowCost, formatEstimate } from "@/lib/cost-estimator";
import { validateObject } from "@/lib/validation";

const estimateSchema = {
  novelLength: {
    required: true,
    type: "number" as const,
    min: 1,
    max: 1000000,
  },
  llmModel: {
    type: "string" as const,
    maxLength: 50,
  },
  imageModel: {
    type: "string" as const,
    maxLength: 50,
  },
  videoModel: {
    type: "string" as const,
    maxLength: 50,
  },
  format: {
    type: "string" as const,
    enum: ["json", "text"],
  },
};

export async function POST(req: Request) {
  try {
    await getCurrentSession();

    const body = await req.json().catch(() => ({}));

    // 如果请求体没有 novelLength，但有 novelText，从 novelText 计算
    if (!body.novelLength && body.novelText) {
      body.novelLength = String(body.novelText).length;
    }

    const validation = validateObject(body, estimateSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: "验证失败", details: validation.errors },
        { status: 400 }
      );
    }

    const data = validation.data as {
      novelLength: number;
      llmModel?: string;
      imageModel?: string;
      videoModel?: string;
      format?: string;
    };

    const estimate = estimateWorkflowCost({
      novelLength: data.novelLength,
      llmModel: data.llmModel,
      imageModel: data.imageModel,
      videoModel: data.videoModel,
    });

    if (data.format === "text") {
      return new Response(formatEstimate(estimate), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json(estimate);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
