# FlintStudio 桌面版

像 Cursor 一样：**一键安装、双击快捷方式即可运行**。内置 Web UI，支持 OpenClaw 远程控制（连接本机地址即可）。

## 依赖说明（方案 B）

- **Redis**：**已内嵌**。在 Windows 下执行 `npm run build` 时会自动下载 [tporadowski/redis](https://github.com/tporadowski/redis) 便携版到 `resources/redis/` 并打入安装包，用户安装后双击即由桌面版自动启动 Redis，无需单独安装。
- **MySQL**：需本机安装并运行在 `localhost:3306`，或使用 Docker 启动（见下）。

### 使用 Docker 启动 MySQL + Redis（推荐）

在**项目根目录**执行（需已安装 [Docker Desktop](https://docs.docker.com/get-docker/)）：

```bash
docker compose -f docker-compose.desktop.yml up -d
```

等待 MySQL/Redis 健康后，再双击桌面版快捷方式即可。

首次使用 MySQL 时需创建数据库（若 docker-compose 未自动创建）：

```bash
# 若使用 docker-compose.desktop.yml，已带 MYSQL_DATABASE=flintstudio，一般无需手动建库
mysql -h127.0.0.1 -uroot -pflintstudio -e "CREATE DATABASE IF NOT EXISTS flintstudio;"
```

## 开发与打包

### 环境要求

- **Node.js 18+**（[官网下载](https://nodejs.org/)）
- （可选）MySQL、Redis：用于本地调试；打安装包时 Redis 会自动下载，MySQL 用户需自行准备

### 新手一键构建 Windows 安装包

在 **PowerShell** 或 **命令提示符** 中，依次执行以下命令（复制粘贴即可）：

```powershell
# 1. 进入项目根目录（请改成你的实际路径，如 C:\Projects\FlintStudio）
cd C:\Projects\FlintStudio

# 2. 安装依赖并构建
npm install
npm run build

# 3. 进入桌面版目录
cd desktop

# 4. 安装桌面版依赖并构建（会下载 Redis、复制 standalone 等）
npm install
npm run build

# 5. 打 Windows 安装包
npm run dist
```

完成后，安装包在 `desktop\release\FlintStudio Setup 0.50.0.exe`，双击安装即可。

### 详细步骤（与上面等效）

1. **在项目根目录构建 Next 与 Prisma**

   ```bash
   cd /path/to/FlintStudio
   npm install
   npm run build
   ```

2. **进入 desktop 并安装依赖**

   ```bash
   cd desktop
   npm install
   ```

3. **构建桌面版（Windows 下会自动下载并内嵌 Redis，再复制 standalone 与 app 到 resources）**

   ```bash
   npm run build
   ```

   若需仅下载 Redis：`npm run download-redis`。

4. **运行桌面版（开发调试）**

   ```bash
   npm start
   ```

   需确保本机 MySQL、Redis 已启动，否则会弹窗提示。

5. **打 Windows 安装包**

   ```bash
   npm run dist
   ```

   产物在 `desktop/release/` 下，如 `FlintStudio Setup 0.50.0.exe`。安装后可创建桌面快捷方式，双击即运行。

## 配置

首次运行后，配置会保存在：

- **Windows**：`%APPDATA%/FlintStudio/config.json`
- **macOS/Linux**：`~/.config/FlintStudio/config.json`

可手动编辑 `DATABASE_URL`、`REDIS_HOST`、`REDIS_PORT`、`PORT` 等（当前桌面版未做 UI 配置页，可后续扩展）。

## OpenClaw 控制

桌面版启动后，Next 服务监听 `http://127.0.0.1:3000`（或配置的 PORT）。OpenClaw 设置服务器地址为 `http://127.0.0.1:3000` 即可远程控制，与浏览器使用方式一致。
