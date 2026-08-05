import { useState, useEffect } from 'react'
import { registerSW } from 'virtual:pwa-register'

// ============================================================
// PWA 更新提示：发现新版本时底部弹出提示条
// prompt 模式下 SW 更新后触发 onNeedRefresh → 提示用户点击刷新
// ============================================================
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {
        setOfflineReady(true)
        setTimeout(() => setOfflineReady(false), 3000)
      },
    })
    // 暴露给全局，供其他位置触发更新
    ;(window as any).__updateSW = updateSW
    return () => { delete (window as any).__updateSW }
  }, [])

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      {needRefresh ? (
        <div className="bg-zinc-900 text-white rounded-xl shadow-xl p-4 flex items-center gap-3">
          <span className="text-lg">✨</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">发现新版本</p>
            <p className="text-xs text-zinc-400 mt-0.5">点击刷新以加载最新内容</p>
          </div>
          <button
            onClick={() => (window as any).__updateSW?.(true)}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-500 transition-colors shrink-0"
          >
            立即刷新
          </button>
        </div>
      ) : (
        <div className="bg-emerald-600 text-white rounded-xl shadow-xl p-3 text-center text-sm">
          已就绪，可离线使用
        </div>
      )}
    </div>
  )
}
