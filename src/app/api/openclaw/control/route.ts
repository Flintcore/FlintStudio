/**
 * OpenClaw 远程控制 API
 * 允许 OpenClaw 完全控制 FlintStudio 运行
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { queueRedis } from "@/lib/redis";
import { QUEUE_NAME } from "@/lib/task/queues";
import type { TaskType } from "@/lib/task/types";
import { selfHealingAgent } from "@/lib/agents/self-healing";

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function validateUuid(value: string | undefined, name: string): string {
  if (!value || typeof value !== "string") {
    throw new Error(`${name} 不能为空`);
  }
  if (!UUID_REGEX.test(value)) {
    throw new Error(`${name} 格式非法，必须为 UUID`);
  }
  return value;
}

// 验证 INTERNAL_TASK_TOKEN
function verifyInternalToken(req: Request): boolean {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  return token === process.env.INTERNAL_TASK_TOKEN;
}

// POST: 执行控制命令
export async function POST(req: Request) {
  try {
    if (!verifyInternalToken(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (body == null) {
      return NextResponse.json(
        { error: "请求体不是有效的 JSON" },
        { status: 400 }
      );
    }
    const { command, params = {} } = body;

    switch (command) {
      // 工作流控制
      case "pause_workflow":
        return await pauseWorkflow(params);
      case "resume_workflow":
        return await resumeWorkflow(params);
      case "cancel_workflow":
        return await cancelWorkflow(params);
      case "retry_task":
        return await retryTask(params);
      
      // 系统控制
      case "restart_service":
        return await restartService(params);
      case "clean_cache":
        return await cleanCache(params);
      
      // 诊断和修复
      case "run_diagnosis":
        return await runDiagnosis(params);
      case "auto_fix":
        return await autoFix(params);
      case "get_healing_stats":
        return await getHealingStats();
      
      // 模型管理
      case "switch_model":
        return await switchModel(params);
      case "test_model":
        return await testModel(params);
      
      // 队列管理
      case "pause_queue":
        return await pauseQueue(params);
      case "resume_queue":
        return await resumeQueue(params);
      case "clear_queue":
        return await clearQueue(params);
      
      default:
        return NextResponse.json(
          { error: `Unknown command: ${command}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[openclaw/control]", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    const isValidation =
      typeof msg === "string" &&
      (msg.includes("不能为空") || msg.includes("格式非法") || msg.includes("对应的记录不存在"));
    return NextResponse.json(
      { error: msg },
      { status: isValidation ? 400 : 500 }
    );
  }
}

// 暂停工作流
async function pauseWorkflow(params: { runId?: string }) {
  const runId = validateUuid(params.runId, "runId");

  const run = await prisma.graphRun.findUnique({ where: { id: runId } });
  if (!run) {
    return NextResponse.json({ error: "runId 对应的记录不存在" }, { status: 400 });
  }

  await prisma.graphRun.update({
    where: { id: runId },
    data: { status: "paused" },
  });
  
  return NextResponse.json({
    success: true,
    message: `工作流 ${runId} 已暂停`,
  });
}

// 恢复工作流
async function resumeWorkflow(params: { runId?: string }) {
  const runId = validateUuid(params.runId, "runId");

  const run = await prisma.graphRun.findUnique({ where: { id: runId } });
  if (!run) {
    return NextResponse.json({ error: "runId 对应的记录不存在" }, { status: 400 });
  }

  await prisma.graphRun.update({
    where: { id: runId },
    data: { status: "running" },
  });
  
  return NextResponse.json({
    success: true,
    message: `工作流 ${runId} 已恢复`,
  });
}

// 取消工作流
async function cancelWorkflow(params: { runId?: string }) {
  const runId = validateUuid(params.runId, "runId");

  const run = await prisma.graphRun.findUnique({ where: { id: runId } });
  if (!run) {
    return NextResponse.json({ error: "runId 对应的记录不存在" }, { status: 400 });
  }

  await prisma.graphRun.update({
    where: { id: runId },
    data: { status: "canceled", finishedAt: new Date() },
  });
  
  // 取消相关任务
  await prisma.task.updateMany({
    where: { runId, status: { in: ["queued", "running"] } },
    data: { status: "canceled" },
  });
  
  return NextResponse.json({
    success: true,
    message: `工作流 ${runId} 已取消`,
  });
}

// 重试任务
async function retryTask(params: { taskId?: string }) {
  const taskId = validateUuid(params.taskId, "taskId");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });
  
  if (!task) {
    return NextResponse.json(
      { error: "taskId 对应的记录不存在" },
      { status: 400 }
    );
  }
  
  // 重置任务状态
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "queued",
      errorMessage: null,
      result: Prisma.JsonNull,
    },
  });
  
  // 重新入队
  const { getQueueByType, getQueueTypeByTaskType } = await import("@/lib/task/queues");
  const taskType = task.type as TaskType;
  const queue = getQueueByType(getQueueTypeByTaskType(taskType));
  
  await queue.add(
    taskType,
    {
      taskId: task.id,
      type: taskType,
      userId: task.userId,
      projectId: task.projectId,
      runId: task.runId || undefined,
      targetType: task.targetType,
      targetId: task.targetId,
      payload: (task.payload as Record<string, unknown>) || undefined,
    },
    { jobId: task.id }
  );
  
  return NextResponse.json({
    success: true,
    message: `任务 ${taskId} 已重新入队`,
  });
}

// 重启服务
async function restartService(params: { service?: string }) {
  const service = params.service || "app";
  
  return NextResponse.json({
    success: true,
    message: `请使用 docker compose restart ${service} 重启服务`,
    command: `docker compose restart ${service}`,
  });
}

// 清理缓存
async function cleanCache(params: { type?: "all" | "images" | "voices" | "videos" }) {
  const type = params.type || "all";
  
  // 清理数据库中的临时数据
  const deletedTasks = await prisma.task.deleteMany({
    where: {
      status: { in: ["completed", "failed", "canceled"] },
      createdAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
      },
    },
  });
  
  return NextResponse.json({
    success: true,
    message: `已清理 ${deletedTasks.count} 个历史任务`,
    details: { deletedTasks: deletedTasks.count },
  });
}

// 运行诊断
async function runDiagnosis(params: { full?: boolean }) {
  const checks = [];
  
  // 数据库连接检查
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: "database", status: "ok", message: "数据库连接正常" });
  } catch (error) {
    checks.push({ name: "database", status: "error", message: `数据库连接失败: ${error instanceof Error ? error.message : String(error)}` });
  }
  
  // Redis 连接检查
  try {
    await queueRedis.ping();
    checks.push({ name: "redis", status: "ok", message: "Redis 连接正常" });
  } catch (error) {
    checks.push({ name: "redis", status: "error", message: `Redis 连接失败: ${error instanceof Error ? error.message : String(error)}` });
  }
  
  // 统计信息
  const stats = {
    activeRuns: await prisma.graphRun.count({ where: { status: { in: ["queued", "running"] } } }),
    pendingTasks: await prisma.task.count({ where: { status: "queued" } }),
    failedTasks: await prisma.task.count({ where: { status: "failed" } }),
  };
  
  return NextResponse.json({
    success: true,
    checks,
    stats,
  });
}

// 自动修复
async function autoFix(params: { issueType?: string }) {
  // 获取最近的失败任务
  const failedTasks = await prisma.task.findMany({
    where: { 
      status: "failed",
      createdAt: {
        gt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24小时内
      },
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  
  const results = [];
  
  for (const task of failedTasks) {
    try {
      // 尝试自我修复
      const result = await selfHealingAgent.heal({
        id: crypto.randomUUID(),
        type: "llm_error",
        severity: "warning",
        message: task.errorMessage || "Unknown error",
        context: {
          userId: task.userId,
          taskId: task.id,
          runId: task.runId || undefined,
          originalError: task.errorMessage || undefined,
          input: task.payload as Record<string, unknown>,
        },
        createdAt: new Date(),
        status: "detected",
        attempts: 0,
      });
      
      results.push({
        taskId: task.id,
        success: result.success,
        action: result.actionTaken,
      });
      
      // 如果修复成功，重试任务
      if (result.success) {
        await retryTask({ taskId: task.id });
      }
    } catch (error) {
      results.push({
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  return NextResponse.json({
    success: true,
    message: `尝试修复 ${failedTasks.length} 个失败任务`,
    results,
  });
}

// 获取修复统计
async function getHealingStats() {
  const stats = selfHealingAgent.getStats();
  
  return NextResponse.json({
    success: true,
    stats,
  });
}

// 切换模型
async function switchModel(params: { userId: string; modelId: string }) {
  const { userId, modelId } = params;
  
  const { setDefaultModel } = await import("@/lib/llm/adaptive-client");
  await setDefaultModel(userId, modelId);
  
  return NextResponse.json({
    success: true,
    message: `已切换到模型: ${modelId}`,
  });
}

// 测试模型
async function testModel(params: { userId: string; modelId?: string }) {
  const { userId, modelId } = params;
  
  try {
    const { callAdaptiveLlm } = await import("@/lib/llm/adaptive-client");
    
    const startTime = Date.now();
    const result = await callAdaptiveLlm({
      userId,
      modelId,
      systemPrompt: "你是一个测试助手。",
      userPrompt: "请回复：模型测试成功",
      temperature: 0.3,
      expectJson: false,
    });
    
    const latency = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: "模型测试成功",
      model: result.model,
      latency: `${latency}ms`,
      cost: result.cost,
      response: result.raw.slice(0, 100),
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: "模型测试失败",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// 暂停队列
async function pauseQueue(params: { queueType: string }) {
  const { queueType } = params;
  
  // 在 Redis 中设置暂停标记
  await queueRedis.set(`queue:${queueType}:paused`, "true");
  
  return NextResponse.json({
    success: true,
    message: `队列 ${queueType} 已暂停`,
  });
}

// 恢复队列
async function resumeQueue(params: { queueType: string }) {
  const { queueType } = params;
  
  await queueRedis.del(`queue:${queueType}:paused`);
  
  return NextResponse.json({
    success: true,
    message: `队列 ${queueType} 已恢复`,
  });
}

// 清空队列
async function clearQueue(params: { queueType: string }) {
  const { queueType } = params;
  
  const queueName = QUEUE_NAME[queueType.toUpperCase() as keyof typeof QUEUE_NAME];
  if (!queueName) {
    return NextResponse.json(
      { error: `Unknown queue type: ${queueType}` },
      { status: 400 }
    );
  }
  
  // 使用 BullMQ 的 obliterate 方法清空队列
  const { Queue } = await import("bullmq");
  const queue = new Queue(queueName, { connection: queueRedis as unknown as import("bullmq").ConnectionOptions });
  await queue.obliterate();
  await queue.close();
  
  return NextResponse.json({
    success: true,
    message: `队列 ${queueType} 已清空`,
  });
}
