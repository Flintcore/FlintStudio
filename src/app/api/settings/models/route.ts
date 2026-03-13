/**
 * 模型配置 API
 * 管理用户的 LLM 模型配置
 */

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { 
  getAvailableModels, 
  getUserModelConfig, 
  saveUserModelConfig,
  type ModelConfig 
} from "@/lib/llm/model-registry";
import { setDefaultModel } from "@/lib/llm/adaptive-client";

// GET: 获取模型列表和当前配置
export async function GET() {
  try {
    const session = await getCurrentSession();
    
    // 获取所有可用模型
    const availableModels = getAvailableModels();
    
    // 获取用户当前默认模型
    const preference = await prisma.userPreference.findUnique({
      where: { userId: session.user.id },
      select: { defaultLlmModel: true, customModels: true },
    });
    
    // 获取每个模型的详细配置
    const modelsWithConfig = await Promise.all(
      availableModels.map(async (m) => {
        const config = await getUserModelConfig(session.user.id, m.id);
        return {
          ...m,
          config: config ? {
            capabilities: config.capabilities,
            defaultParams: config.defaultParams,
            rateLimit: config.rateLimit,
            pricing: config.pricing,
          } : null,
          isDefault: preference?.defaultLlmModel === m.id,
        };
      })
    );
    
    return NextResponse.json({
      models: modelsWithConfig,
      defaultModel: preference?.defaultLlmModel || "gpt-4o-mini",
    });
  } catch (error) {
    console.error("[settings/models GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: 设置默认模型
export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    const body = await req.json();
    const { modelId } = body;
    
    if (!modelId) {
      return NextResponse.json(
        { error: "请提供 modelId" },
        { status: 400 }
      );
    }
    
    await setDefaultModel(session.user.id, modelId);
    
    return NextResponse.json({
      success: true,
      message: `默认模型已设置为: ${modelId}`,
    });
  } catch (error) {
    console.error("[settings/models POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: 更新模型配置
export async function PUT(req: Request) {
  try {
    const session = await getCurrentSession();
    const body = await req.json();
    const { modelId, config } = body;
    
    if (!modelId || !config) {
      return NextResponse.json(
        { error: "请提供 modelId 和 config" },
        { status: 400 }
      );
    }
    
    // 只允许更新部分字段
    const allowedUpdates: Partial<ModelConfig> = {
      defaultParams: config.defaultParams,
      promptStrategy: config.promptStrategy,
    };
    
    await saveUserModelConfig(session.user.id, modelId, allowedUpdates);
    
    return NextResponse.json({
      success: true,
      message: `模型 ${modelId} 配置已更新`,
    });
  } catch (error) {
    console.error("[settings/models PUT]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: 重置模型配置为默认
export async function DELETE(req: Request) {
  try {
    const session = await getCurrentSession();
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");
    
    if (!modelId) {
      return NextResponse.json(
        { error: "请提供 modelId" },
        { status: 400 }
      );
    }
    
    // 删除自定义配置
    await saveUserModelConfig(session.user.id, modelId, {});
    
    return NextResponse.json({
      success: true,
      message: `模型 ${modelId} 配置已重置为默认`,
    });
  } catch (error) {
    console.error("[settings/models DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
