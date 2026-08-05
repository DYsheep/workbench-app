#!/usr/bin/env bash
# ============================================================
# 工作台 - 一键部署脚本（在服务器上执行）
# 前提：域名已解析到本机 IP；setup.sh 已执行
# 用法：sudo bash deploy.sh your-domain.com
# 例：  sudo bash deploy.sh workbench.example.xyz
# ============================================================
set -euo pipefail

DOMAIN="${1:?用法: sudo bash deploy.sh 你的域名，例如 workbench.abc.xyz}"
APP_DIR="/opt/workbench-app"
WEB_ROOT="/var/www/workbench"
REPO_URL="https://github.com/DYsheep/workbench-app.git"

echo "==> [1/6] 拉取项目代码到 $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> [2/6] 安装后端依赖并启动 API 服务（端口 3001）"
cd "$APP_DIR/server"
if [ ! -f .env ]; then
  echo "⚠️  未找到 server/.env，请创建（含 WANWEI_APPCODE）后继续"
  echo "   示例内容："
  echo "   WANWEI_APPCODE=你的阿里云AppCode"
  echo "   PORT=3001"
  exit 1
fi
npm install --omit=dev
# 进程已存在则重启（加载新代码），否则新建
if pm2 describe workbench-api >/dev/null 2>&1; then
  pm2 restart workbench-api --update-env
else
  pm2 start index.js --name workbench-api --cwd "$APP_DIR/server"
fi
pm2 save

echo "==> [3/6] 构建前端（PWA）"
cd "$APP_DIR"
npm install
npm run build

echo "==> [4/6] 部署前端静态文件到 $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rm -rf "$WEB_ROOT"/*
cp -r dist/* "$WEB_ROOT/"
# Nginx 运行用户需可读
chown -R www-data:www-data "$WEB_ROOT"

echo "==> [5/6] 生成 Nginx 配置（HTTPS + /api 反代）"
cat > /etc/nginx/sites-available/workbench.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # 前端静态文件（PWA）
    root $WEB_ROOT;
    index index.html;

    # SPA 路由回退
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Service Worker 不缓存（PWA 更新依赖）
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }

    # 静态资源长缓存（带 hash 的构建产物）
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 证书自动续期入口（certbot）
    location ~ /.well-known/acme-challenge {
        allow all;
    }
}
EOF
ln -sf /etc/nginx/sites-available/workbench.conf /etc/nginx/sites-enabled/workbench.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> [6/6] 申请 Let's Encrypt 免费证书（自动续期）"
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@"$DOMAIN" --redirect

echo ""
echo "=============================================="
echo " 部署完成 🎉"
echo " 访问地址: https://$DOMAIN"
echo " 后端 API: https://$DOMAIN/api (反代 127.0.0.1:3001)"
echo " 管理命令:"
echo "   pm2 logs workbench-api    # 查看后端日志"
echo "   pm2 restart workbench-api # 重启后端"
echo "   systemctl status nginx    # Nginx 状态"
echo "=============================================="
