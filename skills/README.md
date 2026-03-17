# FlintStudio Skills 索引

FlintStudio 提供多个 OpenClaw Skill，用于 AI 自动化部署、控制和创作。

## 可用 Skills

### 1. flintstudio (v2.0.0) 🎬 [推荐]
**用途**: FlintStudio 完整管理套件（合并 deploy + control）

**包含功能**:
- 完整部署（环境检查 + 代码克隆 + 配置 + 启动）
- 服务管理（启动/停止/重启/更新）
- API 密钥配置
- 系统诊断和自动修复
- Beta 0.55 性能优化
- 远程控制（项目管理、工作流控制）

**安装**:
```bash
openclaw skill install flintstudio
```

**使用示例**:
```bash
# 部署
openclaw run flintstudio deploy

# 配置
openclaw run flintstudio config

# 连接并控制
openclaw run flintstudio connect --url http://localhost:13000
openclaw run flintstudio create-project --name "我的短剧"
```

---

### 2. short-drama-writer (v0.55.0) ✍️
**用途**: AI 短剧剧本创作（已安装到 OpenClaw）

**主要功能**:
- 黄金钩子生成（8种模板）
- 情绪过山车设计
- 卡点付费优化
- 5种类型模板（都市战神/甜宠/复仇/穿越/悬疑）
- 自我进化（从成功案例学习）

**安装**:
```bash
openclaw skill install short-drama-writer
```

**使用示例**:
```bash
# 创建新短剧
openclaw run short-drama-writer create \
  --title "龙王赘婿归来" \
  --genre urban-power \
  --episodes 80

# 分析现有剧本
openclaw run short-drama-writer analyze --file script.txt

# 学习成功案例
openclaw run short-drama-writer learn --case case.json

# 触发模板进化
openclaw run short-drama-writer evolve
```

---

## Skill 开发指南

### 创建新 Skill 的步骤

1. **创建目录结构**:
```
skills/your-skill/
├── SKILL.md          # 技能说明文档
├── skill.json        # 技能配置（命令、参数等）
├── index.ts          # 主入口文件
├── package.json      # 依赖配置
└── lib/              # 核心逻辑
    └── ...
```

2. **编写 skill.json**:
```json
{
  "name": "your-skill",
  "version": "1.0.0",
  "description": "技能描述",
  "commands": [
    {
      "name": "command-name",
      "description": "命令描述",
      "params": [...]
    }
  ]
}
```

3. **实现核心逻辑**:
```typescript
// index.ts
export async function main(args: string[]) {
  // 实现功能
}
```

4. **测试和发布**:
```bash
# 本地测试
openclaw skill install ./skills/your-skill
openclaw run your-skill command-name

# 发布到社区
# 提交 PR 到 FlintStudio 仓库
```

---

## 贡献指南

欢迎贡献新的 Skill！请遵循以下规范：

1. **命名规范**: `flintstudio-xxx` 或 `flint-xxx`
2. **版本管理**: 遵循 SemVer 规范
3. **文档完整**: 必须包含 SKILL.md 和示例
4. **安全优先**: 遵循最小权限原则
5. **测试充分**: 提供测试用例

---

*最后更新: 2026-03-16 (Beta 0.55)*
