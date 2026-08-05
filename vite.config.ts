import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 固定 envDir 为项目根目录，避免 cwd 异常导致 .env.development 未加载
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA：四端通用（PC/Web/手机/平板浏览器访问 + 可安装全屏）
    VitePWA({
      registerType: 'autoUpdate', // 发布新版本后自动更新 Service Worker
      includeAssets: ['favicon.svg', 'icons.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '个人工作台',
        short_name: '工作台',
        description: '会议室改造、网络安全运维、文档外包管理、门诊用药等个人工作台',
        lang: 'zh-CN',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        theme_color: '#4f46e5',
        background_color: '#fafafa',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 预缓存构建产物（静态资源离线可用）
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // 动态 API 请求不缓存（数据实时性优先），仅网络优先兜底
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: true, // 开发环境也启用（便于调试），生产自动生效
      },
    }),
  ],
  envDir: __dirname,
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    // 覆盖写入而非清空 dist（规避本地 safe-delete 沙箱限制；服务器部署时会先清空目标目录）
    emptyOutDir: false,
  },
})
