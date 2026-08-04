import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 固定 envDir 为项目根目录，避免 cwd 异常导致 .env.development 未加载
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: __dirname,
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
