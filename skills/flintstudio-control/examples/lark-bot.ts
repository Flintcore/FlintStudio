/**
 * 飞书 Bot 集成示例
 * 
 * 展示如何使用 flintstudio-control Skill 创建飞书 Bot
 * 通过飞书直接控制 FlintStudio
 */

import { execute, parseCommand, setServer } from "../control";

/**
 * 处理飞书消息事件
 */
export interface LarkMessageEvent {
  message: {
    message_id: string;
    chat_id: string;
    content: string;
    msg_type: string;
  };
  sender: {
    sender_id: {
      open_id: string;
    };
    nickname?: string;
  };
}

/**
 * 飞书 API 客户端接口
 */
export interface LarkClient {
  sendMessage: (chatId: string, content: string) => Promise<unknown>;
  replyMessage: (messageId: string, content: string) => Promise<unknown>;
}

/**
 * 处理飞书消息
 */
export async function handleLarkMessage(
  client: LarkClient,
  event: LarkMessageEvent,
  flintStudioUrl?: string
): Promise<void> {
  // 设置 FlintStudio 服务器地址
  if (flintStudioUrl) {
    setServer(flintStudioUrl);
  }

  const { message, sender } = event;
  const { chat_id, message_id, content, msg_type } = message;

  // 只处理文本消息
  if (msg_type !== "text") {
    return;
  }

  // 解析消息内容（飞书消息是 JSON 字符串）
  let text: string;
  try {
    const parsed = JSON.parse(content);
    text = parsed.text || "";
  } catch {
    text = content;
  }

  // 尝试解析命令
  const parsed = parseCommand(text);
  if (!parsed) {
    // 不是命令，可以回复使用帮助
    await client.sendMessage(
      chat_id,
      "👋 你好！我是 FlintStudio 控制助手。\\n\\n发送 \"help\" 查看可用命令。"
    );
    return;
  }

  // 发送 "正在处理" 提示
  await client.replyMessage(message_id, "🔄 正在处理...");

  try {
    // 执行命令
    const result = await execute(parsed.command, parsed.args);
    
    // 发送结果（飞书支持 Markdown）
    await client.sendMessage(chat_id, result);
  } catch (error) {
    await client.sendMessage(
      chat_id,
      `❌ 错误：${error instanceof Error ? error.message : "未知错误"}`
    );
  }
}

/**
 * 创建飞书命令处理器
 */
export function createLarkCommandHandler(flintStudioUrl?: string) {
  return async (client: LarkClient, event: LarkMessageEvent): Promise<void> => {
    await handleLarkMessage(client, event, flintStudioUrl);
  };
}

/**
 * 使用示例
 */
export function example(): void {
  console.log(`
飞书 Bot 使用示例:

1. 创建飞书应用并获取 App ID 和 App Secret

2. 安装依赖:
   npm install @larksuiteoapi/node-sdk

3. 创建 bot.ts:
   import * as lark from "@larksuiteoapi/node-sdk";
   import { createLarkCommandHandler } from "./flintstudio-control/examples/lark-bot";
   
   const client = new lark.Client({
     appId: "YOUR_APP_ID",
     appSecret: "YOUR_APP_SECRET",
   });
   
   const handler = createLarkCommandHandler("http://localhost:13000");
   
   // 在事件处理器中调用
   // handler(client, event);

4. 部署并订阅消息事件

5. 在飞书中使用:
   发送 "help" 查看帮助
   发送 "test-connection" 测试连接
   发送 "start-workflow <项目ID> <文本>" 启动工作流
   发送 "check-status <运行ID>" 检查状态
`);
}

export default { handleLarkMessage, createLarkCommandHandler, example };
