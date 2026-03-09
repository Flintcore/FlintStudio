# FlintStudio Control Skill - 示例

本目录包含不同 IM 平台集成 FlintStudio Control Skill 的示例代码。

## 可用示例

### Telegram Bot (`telegram-bot.ts`)

使用 node-telegram-bot-api 创建 Telegram Bot。

```bash
npm install node-telegram-bot-api
```

### 飞书 Bot (`lark-bot.ts`)

使用 @larksuiteoapi/node-sdk 创建飞书 Bot。

```bash
npm install @larksuiteoapi/node-sdk
```

## 快速开始

### Telegram

```typescript
import TelegramBot from "node-telegram-bot-api";
import { setupTelegramBot } from "flintstudio-control/examples/telegram-bot";

const token = "YOUR_BOT_TOKEN";
const bot = new TelegramBot(token, { polling: true });

// 设置并启动
setupTelegramBot(bot, "http://localhost:13000");
```

### 飞书

```typescript
import * as lark from "@larksuiteoapi/node-sdk";
import { createLarkCommandHandler } from "flintstudio-control/examples/lark-bot";

const client = new lark.Client({
  appId: "YOUR_APP_ID",
  appSecret: "YOUR_APP_SECRET",
});

const handler = createLarkCommandHandler("http://localhost:13000");

// 在事件处理器中使用
// handler(client, event);
```

## 自定义集成

你可以轻松地将此 Skill 集成到其他平台：

```typescript
import { execute, parseCommand, setServer } from "flintstudio-control";

// 1. 设置服务器
setServer("http://your-flintstudio:13000");

// 2. 解析用户输入
const parsed = parseCommand("start-workflow proj_xxx 小说内容");

// 3. 执行命令
if (parsed) {
  const result = await execute(parsed.command, parsed.args);
  // 发送 result 到用户
}
```

## 支持的命令

所有示例都支持以下命令：

- `help` - 显示帮助
- `test-connection` - 测试连接
- `set-server <url>` - 设置服务器
- `create-project [name]` - 创建项目
- `list-projects` - 列出项目
- `delete-project <id>` - 删除项目
- `start-workflow <id> <text> [style]` - 启动工作流
- `list-workflows` - 列出工作流
- `check-status <id>` - 检查状态
- `continue-workflow <id>` - 继续工作流
- `retry-analyze <id>` - 重试分析
- `get-result <id> <episode>` - 获取结果
- `configure-api [type]` - 配置 API
- `get-config` - 查看配置
