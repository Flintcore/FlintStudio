# FlintStudio Complete Management Suite

FlintStudio 完整管理套件 - 合并 deploy + control 功能，支持 Beta 0.55 新特性。

## 版本信息

- **版本**: 2.0.0
- **兼容**: FlintStudio Beta 0.55+
- **合并来源**: flintstudio-deploy (v1.2.0) + flintstudio-control (v1.0.0)

## 安装

```bash
openclaw skill install flintstudio
```

## 功能概览

### 1. 部署管理 (原 flintstudio-deploy)
- 完整部署（环境检查 + 代码克隆 + 配置 + 启动）
- 启动 / 停止 / 重启服务
- 更新到最新版本
- 系统诊断和自动修复
- Beta 0.55 性能优化

### 2. 配置维护 (原 flintstudio-deploy)
- API 密钥配置
- 运行状态检查
- 日志查看
- 数据库备份/恢复
- Docker 清理

### 3. 远程控制 (原 flintstudio-control)
- 连接 FlintStudio 服务器
- 创建/管理项目
- 启动工作流
- 检查进度和结果

## 命令列表

### 部署管理
```bash
# 完整部署
openclaw run flintstudio deploy [--mirror cn|official] [--path ~/FlintStudio]

# 服务管理
openclaw run flintstudio start
openclaw run flintstudio stop
openclaw run flintstudio restart [--quick]

# 更新
openclaw run flintstudio update [--force]
```

### 配置维护
```bash
# 配置 API
openclaw run flintstudio config [--type llm|image|tts|all] [--show]

# 状态检查
openclaw run flintstudio status [--verbose]

# 查看日志
openclaw run flintstudio logs [--service app|mysql|redis] [--lines 100]

# 系统诊断
openclaw run flintstudio doctor [--fix] [--full]

# 性能优化 (Beta 0.55)
openclaw run flintstudio optimize [--indexes]

# 备份恢复
openclaw run flintstudio backup [--path ~/backups]
openclaw run flintstudio restore --file backup.sql

# 清理
openclaw run flintstudio clean [--all]
```

### 远程控制
```bash
# 连接服务器
openclaw run flintstudio connect --url http://localhost:13000

# 项目管理
openclaw run flintstudio create-project --name "项目名"
openclaw run flintstudio list-projects

# 工作流
openclaw run flintstudio start-workflow --project-id xxx --content "内容" [--style live-action]
openclaw run flintstudio check-status --run-id xxx
openclaw run flintstudio get-result --project-id xxx [--episode 1]
```

## Beta 0.55 新特性

- **熔断器机制**: 自动防止 API 故障级联
- **一致性控制**: 角色/场景形象保持稳定
- **性能优化**: 数据库索引 + 批量处理
- **智能重试**: 指数退避，提高成功率

## 与旧版对比

| 功能 | 旧版 (deploy+control) | 新版 (complete) |
|------|---------------------|----------------|
| 安装 | 2 个 skill | 1 个 skill |
| 命令 | 分散在两个 skill | 统一在一个 skill |
| Beta 0.55 | 需分别更新 | 统一更新 |
| 依赖 | 可能有重复 | 合并优化 |

## 迁移指南

从旧版迁移到新版的用户：

```bash
# 1. 卸载旧版
openclaw skill uninstall flintstudio-deploy
openclaw skill uninstall flintstudio-control

# 2. 安装新版
openclaw skill install flintstudio

# 3. 命令保持不变，自动兼容
openclaw run flintstudio deploy  # 原 deploy 命令
openclaw run flintstudio connect # 原 control 命令
```

## 许可证

MIT
