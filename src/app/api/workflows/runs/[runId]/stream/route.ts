/**
 * 工作流运行实时进度推送（SSE）
 * GET /api/workflows/runs/[runId]/stream
 */

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SSEStream, SSE_HEADERS } from "@/lib/sse";
import { logger } from "@/lib/logger";

interface RunSnapshot {
  runId: string;
  status: string;
  currentPhase: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  steps: Array<{
    stepKey: string;
    stepTitle: string;
    status: string;
    stepIndex: number;
    startedAt: string | null;
    finishedAt: string | null;
    errorMessage: string | null;
  }>;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

async function fetchSnapshot(runId: string): Promise<RunSnapshot | null> {
  const run = await prisma.graphRun.findUnique({
    where: { id: runId },
    include: {
      steps: {
        orderBy: { stepIndex: "asc" },
        select: {
          stepKey: true,
          stepTitle: true,
          status: true,
          stepIndex: true,
          startedAt: true,
          finishedAt: true,
          errorMessage: true,
        },
      },
    },
  });

  if (!run) return null;

  const completed = run.steps.filter((s) => s.status === "completed").length;
  const total = run.steps.length;

  return {
    runId: run.id,
    status: run.status,
    currentPhase: run.currentPhase,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    steps: run.steps.map((s) => ({
      stepKey: s.stepKey,
      stepTitle: s.stepTitle,
      status: s.status,
      stepIndex: s.stepIndex,
      startedAt: s.startedAt?.toISOString() ?? null,
      finishedAt: s.finishedAt?.toISOString() ?? null,
      errorMessage: s.errorMessage,
    })),
    progress: {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const session = await getCurrentSession();
    const { runId } = await params;

    // 验证权限
    const run = await prisma.graphRun.findUnique({
      where: { id: runId },
      select: { userId: true },
    });

    if (!run || run.userId !== session.user.id) {
      return new Response(JSON.stringify({ error: "未找到运行" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sse = new SSEStream();
    let pollInterval: NodeJS.Timeout | null = null;
    let lastSnapshotHash = "";

    const stream = sse.createStream({
      onStart: async (s) => {
        // 立即发送初始快照
        const initial = await fetchSnapshot(runId);
        if (initial) {
          s.send(initial, "snapshot");
          lastSnapshotHash = JSON.stringify(initial);
        }

        // 启动轮询（每 2 秒一次）
        pollInterval = setInterval(async () => {
          if (s.isClosed()) {
            if (pollInterval) clearInterval(pollInterval);
            return;
          }

          try {
            const snapshot = await fetchSnapshot(runId);
            if (!snapshot) return;

            // 仅当快照变化时推送
            const newHash = JSON.stringify(snapshot);
            if (newHash !== lastSnapshotHash) {
              s.send(snapshot, "snapshot");
              lastSnapshotHash = newHash;
            }

            // 终止条件
            if (
              snapshot.status === "completed" ||
              snapshot.status === "failed" ||
              snapshot.status === "canceled"
            ) {
              s.send(snapshot, "done");
              setTimeout(() => s.close(), 1000);
              if (pollInterval) clearInterval(pollInterval);
            }
          } catch (error) {
            logger.error(
              {
                type: "sse_poll_error",
                runId,
                error: (error as Error).message,
              },
              "SSE poll error"
            );
          }
        }, 2000);
      },
      onCancel: () => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      },
      heartbeatMs: 30000,
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    logger.error(
      { type: "sse_error", error: (error as Error).message },
      "SSE endpoint error"
    );
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
