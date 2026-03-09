/**
 * Telegram Bot 集成示例
 * 
 * 展示如何使用 flintstudio-control Skill 创建 Telegram Bot
 * 通过 Telegram 直接控制 FlintStudio
 */

import { execute, parseCommand, setServer } from "../control";

// 假设使用 node-telegram-bot-api
// npm install node-telegram-bot-api

interface TelegramBot {
  onText: (regexp: RegExp, callback: (msg: TelegramMessage, match: RegExpExecArray | null) => void) => void;
  sendMessage: (chatId: number | string, text: string, options?: unknown) => Promise<unknown>;
}

interface TelegramMessage {
  chat: { id: number };
  text?: string;
  from?: { username?: string; first_name?: string };
}

/**
 * 设置 Telegram Bot 处理器
 */
export function setupTelegramBot(bot: TelegramBot, flintStudioUrl?: string): void {
  // 设置 FlintStudio 服务器地址
  if (flintStudioUrl) {
    setServer(flintStudioUrl);
  }

  // 处理所有文本消息
  bot.onText(/\/(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const commandText = msg.text || "";

    // 发送 "正在处理" 提示
    await bot.sendMessage(chatId, "🔄 正在处理...");

    try {
      // 尝试解析自然语言命令
      const parsed = parseCommand(commandText);
      
      let result: string;
      if (parsed) {
        // 执行解析后的命令
        result = await execute(parsed.command, parsed.args);
      } else {
        // 未知命令，显示帮助
        result = await execute("help", []);
      }

      // 发送结果
      await bot.sendMessage(chatId, result, { parse_mode: "Markdown" });
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `❌ 错误：${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  });

  // 处理普通消息（自然语言）
  bot.onText(/^(?!\/)/, async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || "";

    // 尝试解析为命令
    const parsed = parseCommand(text);
    if (!parsed) {
      // 不是命令，忽略或使用 AI 回复
      return;
    }

    await bot.sendMessage(chatId, "🔄 正在处理...");

    try {
      const result = await execute(parsed.command, parsed.args);
      await bot.sendMessage(chatId, result, { parse_mode: "Markdown" });
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `❌ 错误：${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  });
}

/**
 * 使用示例
 */
export function example(): void {
  console.log(`
Telegram Bot 使用示例:

1. 安装依赖:
   npm install node-telegram-bot-api

2. 创建 bot.ts:
   import TelegramBot from "node-telegram-bot-api";
   import { setupTelegramBot } from "./flintstudio-control/examples/telegram-bot";
   
   const token = "YOUR_BOT_TOKEN";
   const bot = new TelegramBot(token, { polling: true });
   
   // 设置 FlintStudio 服务器地址
   setupTelegramBot(bot, "http://localhost:13000");
   
   console.log("Bot 已启动");

3. 运行:
   ts-node bot.ts

4. 在 Telegram 中使用:
   /help - 显示帮助
   /test-connection - 测试连接
   /start-workflow <项目ID> <文本> - 启动工作流
   /check-status <运行ID> - 检查状态
`);
}

export default { setupTelegramBot, example };
