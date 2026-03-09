/**
 * FlintStudio 控制逻辑核心
 * 实现所有业务命令，支持本地和远程模式
 */

import {
  FlintStudioClient,
  Project,
  WorkflowRun,
  WorkflowRunDetail,
  ApiConfig,
  ApiError,
} from "./api-client";

// 配置存储
interface ControlConfig {
  baseUrl: string;
  token?: string;
}

// 全局配置
let globalConfig: ControlConfig = {
  baseUrl: "http://localhost:13000",
};

// 客户端实例
let client: FlintStudioClient;

/**
 * 初始化或获取客户端实例
 */
function getClient(): FlintStudioClient {
  if (!client) {
    client = new FlintStudioClient(globalConfig.baseUrl, globalConfig.token);
  }
  return client;
}

/**
 * 设置服务器地址
 */
export function setServer(url: string): void {
  globalConfig.baseUrl = url;
  client = new FlintStudioClient(url, globalConfig.token);
}

/**
 * 获取当前服务器地址
 */
export function getServer(): string {
  return globalConfig.baseUrl;
}

/**
 * 设置认证令牌
 */
export function setToken(token: string): void {
  globalConfig.token = token;
  if (client) {
    client.setToken(token);
  }
}

// ==================== 工具函数 ====================

/**
 * 格式化状态为 emoji
 */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    queued: "⏳ 排队中",
    running: "🔄 运行中",
    completed: "✅ 已完成",
    failed: "❌ 失败",
    canceled: "🚫 已取消",
    pending: "⏸️ 等待中",
  };
  return statusMap[status] || status;
}

/**
 * 格式化阶段为中文
 */
function formatPhase(phase?: string): string {
  if (!phase) return "未知";
  const phaseMap: Record<string, string> = {
    analyze_novel: "📜 剧本分析",
    review_failed: "🔍 复查未通过",
    story_to_script: "📑 分场",
    script_to_storyboard: "🎞️ 分镜",
    image_panels: "🖼️ 出图",
    voice: "🎙️ 配音",
    video: "🎥 视频合成",
  };
  return phaseMap[phase] || phase;
}

/**
 * 格式化时间
 */
function formatTime(dateStr?: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN");
}

/**
 * 截断文本
 */
function truncate(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * 处理错误
 */
function handleError(err: unknown): string {
  const error = err as ApiError;
  if (error.status === 404) {
    return "❌ 请求的资源不存在";
  }
  if (error.status === 401) {
    return "❌ 未授权，请检查登录状态";
  }
  if (error.status === 403) {
    return "❌ 权限不足";
  }
  if (error.status === 400) {
    return `❌ 请求错误：${error.error}`;
  }
  if (error.status === 500) {
    return `❌ 服务器错误：${error.error}`;
  }
  if (error.status === 0) {
    return `❌ 连接失败：${error.error}\n💡 请检查：\n1. FlintStudio 是否已启动\n2. 服务器地址是否正确（当前：${globalConfig.baseUrl}）\n3. 网络连接是否正常`;
  }
  return `❌ 错误：${error.error || "未知错误"}`;
}

// ==================== 命令实现 ====================

/**
 * 显示帮助信息
 */
export function showHelp(): string {
  return `
🎮 **FlintStudio 控制助手**

📋 **项目管理**
• \`create-project [名称]\` - 创建新项目
• \`list-projects [数量]\` - 列出所有项目
• \`delete-project <项目ID>\` - 删除项目

🎬 **工作流控制**
• \`start-workflow <项目ID> <小说文本> [画风]\` - 启动工作流
• \`list-workflows [项目ID] [状态]\` - 查看工作流列表
• \`check-status <运行ID>\` - 检查工作流状态
• \`continue-workflow <运行ID>\` - 继续暂停的工作流
• \`retry-analyze <运行ID>\` - 重试剧本分析

🎨 **画风选项**: default, live_action, unreal_cg, manhua, anime, donghua_3d, cinematic, american_comic

📊 **结果获取**
• \`get-result <项目ID> <剧集编号>\` - 获取生成结果

⚙️ **配置管理**
• \`configure-api [类型]\` - 配置 API 密钥 (llm/image/tts/all)
• \`get-config\` - 查看当前配置
• \`set-server <地址>\` - 设置服务器地址
• \`test-connection\` - 测试连接

💡 **快速开始**:
1. \`test-connection\` - 检查连接
2. \`configure-api all\` - 配置 API
3. \`create-project 我的项目\` - 创建项目
4. \`start-workflow <项目ID> "小说内容..."\` - 启动工作流
`;
}

/**
 * 创建项目
 */
export async function createProject(name?: string): Promise<string> {
  try {
    const c = getClient();
    // 由于没有直接的创建 API，我们模拟创建
    // 实际使用时需要根据实际情况调整
    return `⚠️ 请通过 Web 界面创建项目：${globalConfig.baseUrl}/workspace\n\n创建后可以使用 \`list-projects\` 查看项目列表。`;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 列出项目
 */
export async function listProjects(limit = 20): Promise<string> {
  try {
    const c = getClient();
    // 注意：FlintStudio 当前版本可能没有直接的项目列表 API
    // 这里返回提示用户使用 Web 界面
    return `
📁 **项目列表**

请访问 Web 界面查看和管理项目：
${globalConfig.baseUrl}/workspace

💡 **提示**: 创建项目后，可以从浏览器地址栏获取项目 ID。
项目 URL 格式：${globalConfig.baseUrl}/workspace/<项目ID>
`;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 删除项目
 */
export async function deleteProject(projectId: string): Promise<string> {
  try {
    const c = getClient();
    await c.deleteProject(projectId);
    return `✅ 项目已删除\n\n🆔 项目ID: \`${projectId}\``;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 启动工作流
 */
export async function startWorkflow(
  projectId: string,
  novelText: string,
  visualStyle = "default"
): Promise<string> {
  try {
    const c = getClient();

    // 验证输入长度
    if (novelText.length > 100000) {
      return "❌ 小说文本长度超过限制（最多 10 万字符）";
    }

    // 验证画风
    const validStyles = [
      "default",
      "live_action",
      "unreal_cg",
      "manhua",
      "anime",
      "donghua_3d",
      "cinematic",
      "american_comic",
    ];
    if (!validStyles.includes(visualStyle)) {
      return `❌ 无效的画风：${visualStyle}\n\n可选画风：${validStyles.join(", ")}`;
    }

    const result = await c.startWorkflow(projectId, novelText, visualStyle);

    return `
🎬 **工作流已启动**

🆔 运行ID: \`${result.runId}\`
📊 状态: ${formatStatus(result.status)}
🎨 画风: ${visualStyle}
📝 文本长度: ${novelText.length} 字符

${result.message}

⏱️ 预计耗时：根据文本长度，通常需要 5-30 分钟

💡 **后续操作**:
• 检查状态: \`check-status ${result.runId}\`
• 查看列表: \`list-workflows\`
`;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 列出工作流运行记录
 */
export async function listWorkflows(
  projectId?: string,
  status?: string,
  limit = 20
): Promise<string> {
  try {
    const c = getClient();
    const result = await c.listWorkflows({ projectId, status, limit });

    if (result.runs.length === 0) {
      return "📭 暂无工作流运行记录";
    }

    let output = "📊 **工作流运行记录**\n\n";
    result.runs.forEach((run, index) => {
      output += `${index + 1}. ${formatStatus(run.status)} | ${formatPhase(
        run.currentPhase
      )}\n`;
      output += `   🆔 \`${run.id}\`\n`;
      output += `   📅 创建: ${formatTime(run.queuedAt)}\n`;
      if (run.errorMessage) {
        output += `   ⚠️ 错误: ${truncate(run.errorMessage, 50)}\n`;
      }
      output += "\n";
    });

    output += `💡 **提示**: 使用 \`check-status <运行ID>\` 查看详情`;
    return output;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 检查工作流状态
 */
export async function checkStatus(runId: string): Promise<string> {
  try {
    const c = getClient();
    const run = await c.getWorkflowRun(runId);

    let output = `
📊 **工作流运行状态**

🆔 运行ID: \`${run.id}\`
📋 工作流: ${run.workflowId}
📊 状态: ${formatStatus(run.status)}
🔷 当前阶段: ${formatPhase(run.currentPhase)}
📅 创建时间: ${formatTime(run.queuedAt)}
▶️ 开始时间: ${formatTime(run.startedAt)}
🏁 完成时间: ${formatTime(run.finishedAt)}
`;

    if (run.errorMessage) {
      output += `\n❌ **错误信息**: ${run.errorMessage}\n`;
    }

    if (run.steps && run.steps.length > 0) {
      output += "\n📋 **执行步骤**:\n\n";
      run.steps.forEach((step, index) => {
        const status = step.status === "completed" ? "✅" : 
                      step.status === "running" ? "🔄" : 
                      step.status === "failed" ? "❌" : "⏸️";
        output += `${index + 1}. ${status} ${step.stepTitle}\n`;
        if (step.startedAt) {
          output += `   开始: ${formatTime(step.startedAt)}\n`;
        }
        if (step.finishedAt) {
          output += `   完成: ${formatTime(step.finishedAt)}\n`;
        }
      });
    }

    // 根据不同状态给出建议
    output += "\n💡 **操作建议**:\n";
    if (run.status === "completed") {
      output += "• 使用 \`get-result <项目ID> <剧集编号>\` 查看结果\n";
      output += "• 可以开始新的工作流\n";
    } else if (run.status === "running") {
      output += "• 工作流正在执行，请稍后再检查\n";
      output += "• 使用 \`check-status " + runId + "\` 刷新状态\n";
    } else if (run.status === "failed") {
      output += "• 检查错误信息，修复后重试\n";
      if (run.currentPhase?.includes("analyze")) {
        output += "• 使用 \`retry-analyze " + runId + "\` 重试分析\n";
      }
    } else if (run.currentPhase === "review_failed") {
      output += "• 剧本分析需要人工复查\n";
      output += "• 登录 Web 界面检查分析结果\n";
      output += "• 确认无误后使用 \`continue-workflow " + runId + "\` 继续\n";
    }

    return output;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 继续工作流
 */
export async function continueWorkflow(runId: string): Promise<string> {
  try {
    const c = getClient();
    await c.continueWorkflow(runId);
    return `
▶️ **工作流已继续**

🆔 运行ID: \`${runId}\`

工作流将从暂停点继续执行。

💡 **检查状态**: \`check-status ${runId}\`
`;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 重试剧本分析
 */
export async function retryAnalyze(runId: string): Promise<string> {
  try {
    const c = getClient();
    await c.retryAnalyze(runId);
    return `
🔄 **剧本分析已重试**

🆔 运行ID: \`${runId}\`

系统将重新执行剧本分析步骤。

💡 **检查状态**: \`check-status ${runId}\`
`;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 获取生成结果
 */
export async function getResult(
  projectId: string,
  episodeNumber: number
): Promise<string> {
  try {
    // 构建访问链接
    const projectUrl = `${globalConfig.baseUrl}/workspace/${projectId}`;
    const episodeUrl = `${globalConfig.baseUrl}/workspace/${projectId}/episode/${episodeNumber}`;

    return `
🎉 **剧集生成结果**

🆔 项目ID: \`${projectId}\`
📺 剧集编号: 第 ${episodeNumber} 集

🔗 **访问链接**:
• 项目页面: ${projectUrl}
• 剧集详情: ${episodeUrl}

📥 **下载方式**:
1. 访问剧集详情页面
2. 点击视频播放器下方的下载按钮
3. 或右键视频选择"另存为"

💡 **提示**: 视频文件也会保存在服务器的 data 目录中
`;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 配置 API
 */
export async function configureApi(type = "all"): Promise<string> {
  const validTypes = ["llm", "image", "tts", "all"];
  if (!validTypes.includes(type)) {
    return `❌ 无效的配置类型：${type}\n\n可选类型：${validTypes.join(", ")}`;
  }

  return `
⚙️ **API 配置向导**

当前配置类型：${type}

📋 **配置说明**:
1. 请先登录 FlintStudio Web 界面
2. 进入「设置 → API 配置」页面
3. 填写以下信息：

🤖 **LLM API**（大语言模型）:
• 用途：剧本分析、分场、分镜、对白提取
• 推荐：OpenRouter、Comfly、云雾
• 格式：OpenAI 兼容接口

🎨 **图像 API**:
• 用途：分镜图生成
• 推荐：OpenAI DALL-E、通义万相
• 格式：OpenAI 兼容接口

🎙️ **TTS API**（语音合成）:
• 用途：配音生成
• 推荐：OpenAI TTS、讯飞
• 格式：OpenAI /v1/audio/speech 兼容

🔗 **配置页面**: ${globalConfig.baseUrl}/settings

💡 **查看当前配置**: \`get-config\`
`;
}

/**
 * 获取当前配置
 */
export async function getConfig(): Promise<string> {
  try {
    const c = getClient();
    const config = await c.getApiConfig();

    // 隐藏 API Key 的敏感部分
    const maskKey = (key?: string) => {
      if (!key) return "未设置";
      if (key.length <= 8) return "****";
      return key.substring(0, 4) + "****" + key.substring(key.length - 4);
    };

    return `
⚙️ **当前 API 配置**

🤖 **LLM 配置**:
• Base URL: ${config.llmBaseUrl || "未设置"}
• API Key: ${maskKey(config.llmApiKey)}
• 分析模型: ${config.analysisModel || "默认"}
• 分镜模型: ${config.storyboardModel || "默认"}

🎨 **图像配置**:
• Base URL: ${config.imageBaseUrl || "未设置"}
• API Key: ${maskKey(config.imageApiKey)}

🎙️ **TTS 配置**:
• Base URL: ${config.ttsBaseUrl || "未设置"}
• API Key: ${maskKey(config.ttsApiKey)}

🎬 **视频配置**:
• Base URL: ${config.videoBaseUrl || "未设置"}
• API Key: ${maskKey(config.videoApiKey)}
• 视频模型: ${config.videoModel || "默认"}

💡 **修改配置**: 访问 ${globalConfig.baseUrl}/settings
`;
  } catch (err) {
    return handleError(err);
  }
}

/**
 * 测试连接
 */
export async function testConnection(): Promise<string> {
  try {
    const c = getClient();
    await c.testConnection();
    return `
✅ **连接成功**

🌐 服务器地址: ${globalConfig.baseUrl}
📊 状态: 正常运行

FlintStudio 服务可正常访问。
`;
  } catch (err) {
    return handleError(err);
  }
}

// ==================== 自然语言处理 ====================

/**
 * 解析自然语言指令
 */
export function parseCommand(input: string): {
  command: string;
  args: string[];
} | null {
  const trimmed = input.trim().toLowerCase();

  // 帮助
  if (/^(help|帮助|菜单|指令|命令)$/i.test(trimmed)) {
    return { command: "help", args: [] };
  }

  // 测试连接
  if (/^(test-connection|测试连接|测试|ping)$/i.test(trimmed)) {
    return { command: "test-connection", args: [] };
  }

  // 列出项目
  if (/^(list-projects|项目列表|所有项目|查看项目)$/i.test(trimmed)) {
    return { command: "list-projects", args: [] };
  }

  // 创建项目
  const createProjectMatch = trimmed.match(
    /^(create-project|创建项目|新建项目)\s*(.*)?$/i
  );
  if (createProjectMatch) {
    return {
      command: "create-project",
      args: createProjectMatch[2] ? [createProjectMatch[2].trim()] : [],
    };
  }

  // 删除项目
  const deleteProjectMatch = trimmed.match(
    /^(delete-project|删除项目)\s+(\S+)$/i
  );
  if (deleteProjectMatch) {
    return { command: "delete-project", args: [deleteProjectMatch[2]] };
  }

  // 启动工作流
  const startWorkflowMatch = trimmed.match(
    /^(start-workflow|启动工作流|开始生成|一键成片)\s+(\S+)\s+(.+)$/i
  );
  if (startWorkflowMatch) {
    return {
      command: "start-workflow",
      args: [startWorkflowMatch[2], startWorkflowMatch[3]],
    };
  }

  // 列出工作流
  if (/^(list-workflows|工作流列表|查看工作流)$/i.test(trimmed)) {
    return { command: "list-workflows", args: [] };
  }

  // 检查状态
  const checkStatusMatch = trimmed.match(
    /^(check-status|检查状态|查看状态|状态)\s+(\S+)$/i
  );
  if (checkStatusMatch) {
    return { command: "check-status", args: [checkStatusMatch[2]] };
  }

  // 继续工作流
  const continueMatch = trimmed.match(
    /^(continue-workflow|继续|继续工作流)\s+(\S+)$/i
  );
  if (continueMatch) {
    return { command: "continue-workflow", args: [continueMatch[2]] };
  }

  // 重试分析
  const retryMatch = trimmed.match(
    /^(retry-analyze|重试分析|重新分析)\s+(\S+)$/i
  );
  if (retryMatch) {
    return { command: "retry-analyze", args: [retryMatch[2]] };
  }

  // 获取结果
  const getResultMatch = trimmed.match(
    /^(get-result|获取结果|查看结果|结果)\s+(\S+)\s+(\d+)$/i
  );
  if (getResultMatch) {
    return {
      command: "get-result",
      args: [getResultMatch[2], getResultMatch[3]],
    };
  }

  // 配置 API
  const configMatch = trimmed.match(/^(configure-api|配置api|配置)\s*(\S+)?$/i);
  if (configMatch) {
    return {
      command: "configure-api",
      args: configMatch[2] ? [configMatch[2]] : ["all"],
    };
  }

  // 获取配置
  if (/^(get-config|查看配置|当前配置)$/i.test(trimmed)) {
    return { command: "get-config", args: [] };
  }

  // 设置服务器
  const setServerMatch = trimmed.match(
    /^(set-server|设置服务器|服务器)\s+(\S+)$/i
  );
  if (setServerMatch) {
    return { command: "set-server", args: [setServerMatch[2]] };
  }

  return null;
}

/**
 * 执行命令
 */
export async function execute(
  command: string,
  args: string[]
): Promise<string> {
  switch (command) {
    case "help":
      return showHelp();
    case "create-project":
      return createProject(args[0]);
    case "list-projects":
      return listProjects(parseInt(args[0]) || 20);
    case "delete-project":
      if (!args[0]) return "❌ 请提供项目ID";
      return deleteProject(args[0]);
    case "start-workflow":
    case "create-episode":
      if (!args[0] || !args[1])
        return "❌ 用法: start-workflow <项目ID> <小说文本> [画风]";
      return startWorkflow(args[0], args[1], args[2]);
    case "list-workflows":
      return listWorkflows(args[0], args[1], parseInt(args[2]) || 20);
    case "check-status":
      if (!args[0]) return "❌ 请提供运行ID";
      return checkStatus(args[0]);
    case "continue-workflow":
      if (!args[0]) return "❌ 请提供运行ID";
      return continueWorkflow(args[0]);
    case "retry-analyze":
      if (!args[0]) return "❌ 请提供运行ID";
      return retryAnalyze(args[0]);
    case "get-result":
      if (!args[0] || !args[1])
        return "❌ 用法: get-result <项目ID> <剧集编号>";
      return getResult(args[0], parseInt(args[1]));
    case "configure-api":
      return configureApi(args[0] || "all");
    case "get-config":
      return getConfig();
    case "set-server":
      if (!args[0]) return "❌ 请提供服务器地址";
      setServer(args[0]);
      return `✅ 服务器地址已设置为: ${args[0]}\n\n💡 **测试连接**: \`test-connection\``;
    case "test-connection":
      return testConnection();
    default:
      return `❌ 未知命令: ${command}\n\n${showHelp()}`;
  }
}

export default {
  setServer,
  getServer,
  setToken,
  showHelp,
  createProject,
  listProjects,
  deleteProject,
  startWorkflow,
  listWorkflows,
  checkStatus,
  continueWorkflow,
  retryAnalyze,
  getResult,
  configureApi,
  getConfig,
  testConnection,
  parseCommand,
  execute,
};
