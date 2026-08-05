// ============================================================
// 刷新与缓存清理工具（PWA 专用）
// 手机上 PWA 没有 F5，通过用户面板提供刷新/硬刷新入口
// ============================================================

/** 普通刷新（等价 F5，保留 PWA 缓存） */
export function softRefresh() {
  window.location.reload()
}

/** 硬刷新：清空 PWA 缓存 + 注销 Service Worker + 重新加载 */
export async function hardRefresh(): Promise<void> {
  try {
    // 1. 清空 Cache Storage（PWA 预缓存 + 运行时缓存）
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    // 2. 注销所有 Service Worker（下次加载重新注册，拉取最新 sw.js）
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch (e) {
    console.error('清理缓存失败:', e)
  }
  // 3. 强制重新加载（绕过浏览器缓存）
  window.location.reload()
}
