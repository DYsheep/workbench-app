#!/usr/bin/env bash
# ============================================================
# 工作台 - 服务器初始化脚本（Ubuntu 24.04 LTS）
# 作用：安装 Nginx + Node.js 22 + pm2，创建部署目录
# 用法：sudo bash setup.sh
# ============================================================
set -euo pipefail

echo "==> [1/4] 更新系统软件源"
apt-get update -y
apt-get upgrade -y

echo "==> [2/4] 安装 Nginx"
apt-get install -y nginx

echo "==> [3/4] 安装 Node.js 22 LTS（NodeSource 官方源）"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node -v && npm -v

echo "==> [4/4] 安装 pm2（进程守护）"
npm install -g pm2

echo ""
echo "=============================================="
echo " 环境初始化完成 ✅"
echo "  Nginx: $(nginx -v 2>&1)"
echo "  Node:  $(node -v)"
echo "  pm2:   $(pm2 -v)"
echo ""
echo " 下一步：配置域名解析后执行 deploy.sh"
echo "=============================================="
