# 工作台部署指南（腾讯云轻量服务器 · Ubuntu 24.04 LTS）

> 香港轻量服务器，**免 ICP 备案**，当天可上线。

## 部署前准备（腾讯云控制台操作）

| 步骤 | 操作 | 路径 |
|------|------|------|
| 1 | **购买域名**（如 `workbench.xxx.xyz`，约 10-20 元/年） | 控制台 → 域名注册 |
| 2 | 域名实名认证（个人，几分钟） | 控制台 → 域名注册 → 实名认证 |
| 3 | **DNS 解析**：添加 A 记录 `@` 和 `www` → 服务器公网 IP | 控制台 → DNS 解析 DNSPod |
| 4 | **重置 root 密码** | 轻量服务器 → 服务器详情 → 重置密码 |
| 5 | **防火墙放行端口**：22 / 80 / 443 | 轻量服务器 → 防火墙 → 添加规则 |

## 一键部署（SSH 连接服务器后执行）

```bash
# 1. 连接服务器（Mac/Linux 终端或 Windows PowerShell）
ssh root@你的服务器IP

# 2. 初始化环境（Nginx + Node 22 + pm2，约 3 分钟）
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/DYsheep/workbench-app/main/deploy/setup.sh)"

# 3. 创建后端配置（含万维易源 AppCode，不提交 git）
cd /opt/workbench-app/server   # 若 clone 失败可先手动：git clone https://github.com/DYsheep/workbench-app.git /opt/workbench-app
nano .env
# 内容示例：
#   WANWEI_APPCODE=你的阿里云AppCode
#   PORT=3001

# 4. 一键部署（拉代码 + 构建 + pm2 + Nginx + 免费证书）
sudo bash /opt/workbench-app/deploy/deploy.sh 你的域名.com
```

> 注：`deploy.sh` 从 GitHub 拉取仓库，`setup.sh` 需服务器能访问 GitHub（香港服务器无障碍）。

## 部署后验证

```bash
curl -I https://你的域名.com          # 前端 → 200
curl https://你的域名.com/api/stats   # 后端反代 → 401（未登录属正常，说明代理通了）
```

手机浏览器打开 `https://你的域名.com` → 登录 → 菜单"添加到主屏幕" → 全屏 App 体验。

## 常用运维命令

```bash
pm2 logs workbench-api        # 后端日志
pm2 restart workbench-api     # 重启后端
pm2 save                      # 保存进程列表（开机自启）
sudo certbot renew --dry-run  # 测试证书自动续期
```

## 数据备份（SQLite）

```bash
# 药品索引可随时重建；关键数据仅 users/workspaces/files（小）
cp /opt/workbench-app/server/data/workbench.db ~/backup-$(date +%F).db
```

## 常见问题

- **后端 502**：`pm2 status` 看进程是否 alive；`pm2 logs` 查报错；常见是 `.env` 缺失
- **证书失败**：确认 DNS 已解析（`dig 你的域名` 返回服务器 IP）；certbot 需 80 端口可达
- **更新部署**：重新执行 `sudo bash /opt/workbench-app/deploy/deploy.sh 你的域名.com`（git pull + 重建 + reload）
