# FlintStudio 开源版 — GitHub 发布清单

## 发布前检查

- [ ] 在 GitHub 新建仓库（如 `FlintStudio` 或 `flint-studio`）
- [ ] 本地初始化 git（若尚未）：  
  `git init && git add . && git commit -m "chore: initial FlintStudio open source"`
- [ ] 添加远程并推送：  
  `git remote add origin https://github.com/YOUR_USERNAME/FlintStudio.git`  
  `git push -u origin main`
- [ ] 确认 README.md、LICENSE、.env.example 已提交
- [ ] 在仓库 Settings → General 填写 Description、Website（可选）、Topics：`ai`, `video`, `film`, `open-source`, `nextjs`

## 创建 Release

1. 打开仓库 **Releases** → **Create a new release**
2. **Tag**: `v0.1.0`（Create new tag）
3. **Title**: `v0.1.0 - FlintStudio 开源版首发`
4. **Description** 示例：

```markdown
## FlintStudio 开源版 v0.1.0

全 API 可配置的 AI 影视自动化多 Agent 协同平台。

### 功能
- 剧本分析（LLM 可配）
- 角色与场景图生成（图像 API 可配）
- 分镜、配音、视频合成流水线（语音/视频 API 可配）
- 设置中心统一配置所有 API，无厂商锁定

### 技术栈
Next.js 15 · React 19 · MySQL · Prisma · Redis · BullMQ · Tailwind v4 · NextAuth

### 一键启动
\`\`\`bash
git clone https://github.com/YOUR_USERNAME/FlintStudio.git
cd FlintStudio
docker compose up -d
# 访问 http://localhost:13000
\`\`\`

### 文档
- [README](https://github.com/YOUR_USERNAME/FlintStudio#readme)
- [项目规划](FLINTSTUDIO_PLAN.md)
```

5. 勾选 **Set as the latest release**，发布。

## 后续迭代

- 在 README 或 CHANGELOG 中维护版本与更新说明
- 新功能合并到 `main` 后打新 tag（如 `v0.2.0`）并创建 Release
