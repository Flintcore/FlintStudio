#!/bin/bash
# FlintStudio Deploy Skill 安装脚本
# Install script for FlintStudio Deploy Skill

set -e

SKILL_NAME="flintstudio-deploy"
SKILL_VERSION="1.0.0"
SKILL_DIR="${HOME}/.openclaw/skills/${SKILL_NAME}"

echo "🎬 FlintStudio Deploy Skill 安装器"
echo "===================================="
echo ""

# 检查 OpenClaw 是否安装
check_openclaw() {
    if ! command -v openclaw &> /dev/null; then
        echo "❌ OpenClaw 未安装"
        echo ""
        echo "请先安装 OpenClaw:"
        echo "  npm install -g openclaw"
        echo ""
        echo "或访问: https://github.com/openclaw/openclaw"
        exit 1
    fi
    echo "✅ OpenClaw 已安装"
}

# 创建 Skill 目录
create_skill_dir() {
    echo "📁 创建 Skill 目录..."
    mkdir -p "${SKILL_DIR}"
    echo "✅ 目录创建成功: ${SKILL_DIR}"
}

# 下载 Skill 文件
download_skill() {
    echo "📥 下载 Skill 文件..."
    
    # 获取脚本所在目录
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    if [ -f "${SCRIPT_DIR}/skill.json" ]; then
        # 本地安装
        echo "  从本地目录安装..."
        cp -r "${SCRIPT_DIR}"/* "${SKILL_DIR}/"
    else
        # 从 GitHub 下载
        echo "  从 GitHub 下载..."
        GITHUB_URL="https://github.com/Flintcore/FlintStudio/raw/main/skills/${SKILL_NAME}"
        
        curl -fsSL "${GITHUB_URL}/skill.json" -o "${SKILL_DIR}/skill.json"
        curl -fsSL "${GITHUB_URL}/deploy.ts" -o "${SKILL_DIR}/deploy.ts"
        curl -fsSL "${GITHUB_URL}/README.md" -o "${SKILL_DIR}/README.md"
    fi
    
    echo "✅ Skill 文件下载完成"
}

# 注册 Skill 到 OpenClaw
register_skill() {
    echo "📝 注册 Skill 到 OpenClaw..."
    
    # 创建 OpenClaw 配置目录
    OPENCLAW_CONFIG="${HOME}/.openclaw"
    mkdir -p "${OPENCLAW_CONFIG}/skills"
    
    # 创建 skill 链接
    ln -sf "${SKILL_DIR}" "${OPENCLAW_CONFIG}/skills/${SKILL_NAME}"
    
    echo "✅ Skill 注册成功"
}

# 安装依赖
install_deps() {
    echo "📦 检查依赖..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        echo "⚠️  未检测到 Node.js，请先安装 Node.js 18+"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "${NODE_VERSION}" -lt 18 ]; then
        echo "⚠️  Node.js 版本过低，需要 18+，当前版本: $(node -v)"
        exit 1
    fi
    
    echo "✅ Node.js 版本: $(node -v)"
    
    # 检查是否需要安装 ts-node
    if ! command -v ts-node &> /dev/null; then
        echo "📥 安装 ts-node..."
        npm install -g ts-node typescript
        echo "✅ ts-node 安装完成"
    else
        echo "✅ ts-node 已安装"
    fi
}

# 显示使用说明
show_usage() {
    echo ""
    echo "✨ 安装完成！"
    echo "===================================="
    echo ""
    echo "使用方法："
    echo ""
    echo "1️⃣  直接对话部署（最简单）:"
    echo "   openclaw"
    echo "   然后输入: 帮我部署 FlintStudio"
    echo ""
    echo "2️⃣  使用命令部署:"
    echo "   openclaw run ${SKILL_NAME} deploy"
    echo ""
    echo "3️⃣  查看状态:"
    echo "   openclaw run ${SKILL_NAME} status"
    echo ""
    echo "4️⃣  查看日志:"
    echo "   openclaw run ${SKILL_NAME} logs"
    echo ""
    echo "可用命令:"
    echo "   deploy          - 完整部署"
    echo "   start           - 启动服务"
    echo "   stop            - 停止服务"
    echo "   update          - 更新版本"
    echo "   logs [service]  - 查看日志"
    echo "   status          - 检查状态"
    echo "   backup [path]   - 备份数据"
    echo "   reset yes       - 重置数据"
    echo ""
    echo "访问地址: http://localhost:13000"
    echo ""
    echo "📖 详细文档: ${SKILL_DIR}/README.md"
    echo "🐛 问题反馈: https://github.com/Flintcore/FlintStudio/issues"
    echo ""
}

# 主函数
main() {
    check_openclaw
    create_skill_dir
    download_skill
    register_skill
    install_deps
    show_usage
}

# 运行主函数
main
