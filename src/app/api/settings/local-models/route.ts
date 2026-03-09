/**
 * 本地模型配置 API
 * GET: 获取当前配置
 * POST: 更新配置并测试连接
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OllamaClient } from "@/lib/local-models/ollama-client";
import { ComfyUIClient } from "@/lib/local-models/comfyui-client";

// 获取本地模型配置
export async function GET() {
  try {
    // 从环境变量获取配置
    const config = {
      ollama: {
        enabled: process.env.OLLAMA_ENABLED === "true",
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: process.env.OLLAMA_MODEL || "llama3.2",
        available: false,
        models: [] as string[],
      },
      comfyui: {
        enabled: process.env.COMFYUI_ENABLED === "true",
        baseUrl: process.env.COMFYUI_BASE_URL || "http://localhost:8188",
        defaultCheckpoint: process.env.COMFYUI_CHECKPOINT || "",
        available: false,
        models: [] as string[],
      },
    };

    // 测试 Ollama 连接
    if (config.ollama.enabled) {
      try {
        const client = new OllamaClient({
          baseUrl: config.ollama.baseUrl,
          model: config.ollama.model,
        });
        const isAvailable = await client.checkConnection();
        config.ollama.available = isAvailable;

        if (isAvailable) {
          const models = await client.listModels();
          config.ollama.models = models.map((m) => m.name);
        }
      } catch {
        // 忽略错误
      }
    }

    // 测试 ComfyUI 连接
    if (config.comfyui.enabled) {
      try {
        const client = new ComfyUIClient({
          baseUrl: config.comfyui.baseUrl,
        });
        const isAvailable = await client.checkConnection();
        config.comfyui.available = isAvailable;

        if (isAvailable) {
          const models = await client.getAvailableModels("checkpoints");
          config.comfyui.models = models.map((m) => m.name);
        }
      } catch {
        // 忽略错误
      }
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("[settings/local-models GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get config" },
      { status: 500 }
    );
  }
}

// 更新配置并测试连接
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, config } = body;

    if (!type || !config) {
      return NextResponse.json(
        { error: "Missing type or config" },
        { status: 400 }
      );
    }

    let testResult = {
      success: false,
      message: "",
      models: [] as string[],
    };

    if (type === "ollama") {
      // 测试 Ollama 连接
      const client = new OllamaClient({
        baseUrl: config.baseUrl,
        model: config.model,
      });

      const isAvailable = await client.checkConnection();
      testResult.success = isAvailable;

      if (isAvailable) {
        testResult.message = "Ollama 连接成功";
        const models = await client.listModels();
        testResult.models = models.map((m) => m.name);
      } else {
        testResult.message = "无法连接到 Ollama 服务，请检查服务是否运行";
      }
    } else if (type === "comfyui") {
      // 测试 ComfyUI 连接
      const client = new ComfyUIClient({
        baseUrl: config.baseUrl,
        defaultCheckpoint: config.defaultCheckpoint,
      });

      const isAvailable = await client.checkConnection();
      testResult.success = isAvailable;

      if (isAvailable) {
        testResult.message = "ComfyUI 连接成功";
        const stats = await client.getSystemStats();
        testResult.message += ` (${stats.devices.length} 个设备)`;

        try {
          const models = await client.getAvailableModels("checkpoints");
          testResult.models = models.map((m) => m.name);
        } catch {
          // 某些 ComfyUI 版本可能不支持获取模型列表
          testResult.models = [];
        }
      } else {
        testResult.message = "无法连接到 ComfyUI 服务，请检查服务是否运行";
      }
    } else {
      return NextResponse.json(
        { error: "Invalid type, must be 'ollama' or 'comfyui'" },
        { status: 400 }
      );
    }

    return NextResponse.json(testResult);
  } catch (error) {
    console.error("[settings/local-models POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to test connection" },
      { status: 500 }
    );
  }
}
