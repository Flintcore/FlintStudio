import { NextRequest, NextResponse } from "next/server";
import { advanceRun } from "@/lib/workflow/service";
import { env } from "@/lib/env";

const INTERNAL_TOKEN = env.INTERNAL_TASK_TOKEN;

/** Worker 在任务完成后调用，推进工作流到下一阶段 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!INTERNAL_TOKEN || token !== INTERNAL_TOKEN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (body == null) {
    return NextResponse.json(
      { error: "请求体不是有效的 JSON" },
      { status: 400 }
    );
  }
  const runId = String(body.runId ?? "").trim();
  const taskId = String(body.taskId ?? "").trim();
  if (!runId || !taskId) {
    return NextResponse.json(
      { error: "runId 和 taskId 必填且不能为空" },
      { status: 400 }
    );
  }

  await advanceRun(runId, taskId);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
