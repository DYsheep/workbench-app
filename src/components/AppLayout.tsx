import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Icon } from './icons'
import { UpdatePrompt } from './UpdatePrompt'
import { softRefresh, hardRefresh } from '../lib/refresh'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { to: '/', label: '仪表盘', icon: 'LayoutDashboard' as const },
  { to: '/drugs', label: '门诊用药', icon: 'Pill' as const },
  { to: '/kalimba', label: '拇指琴', icon: 'Music' as const },
  { to: '/plans', label: '我的计划', icon: 'Calendar' as const },
  { to: '/relations', label: '关系梳理', icon: 'Heart' as const },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  // 桌面端：侧栏折叠状态
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // 移动端：抽屉开关
  const [mobileNav, setMobileNav] = useState(false)
  // 用户面板（底部上弹）
  const [userPanel, setUserPanel] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Esc 关闭用户面板
  useEffect(() => {
    if (!userPanel) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setUserPanel(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [userPanel])

  const handleHardRefresh = async () => {
    setRefreshing(true)
    await hardRefresh()
  }

  const SidebarContent = ({ collapsed, onNavigate, onOpenUser }: {
    collapsed: boolean
    onNavigate?: () => void
    onOpenUser: () => void
  }) => (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-zinc-100 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <span className="text-white font-semibold text-sm">W</span>
        </div>
        {!collapsed && <span className="ml-3 font-semibold text-zinc-800 text-sm">工作台</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`
            }
          >
            <Icon name={item.icon} size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User - 点击打开用户面板 */}
      <div className="border-t border-zinc-100 p-3 shrink-0">
        <button
          onClick={onOpenUser}
          className="w-full flex items-center gap-3 rounded-lg hover:bg-zinc-50 transition-colors p-1"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-indigo-700 font-medium text-xs">
              {user?.name?.charAt(0)}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-zinc-800 truncate">{user?.name}</p>
              <p className="text-xs text-zinc-400 truncate">{user?.role}</p>
            </div>
          )}
          <Icon name="ChevronDown" size={14} className="text-zinc-300 shrink-0" />
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* ===== 桌面侧栏（lg 及以上常驻，可折叠） ===== */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-zinc-200 transition-all duration-200 shrink-0 ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        <SidebarContent collapsed={!sidebarOpen} onOpenUser={() => setUserPanel(true)} />
      </aside>

      {/* ===== 移动端抽屉（<lg 覆盖式） ===== */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNav(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col border-r border-zinc-200 shadow-xl">
            <div className="flex justify-end pr-2 pt-2 shrink-0">
              <button
                onClick={() => setMobileNav(false)}
                className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400"
              >
                <Icon name="X" size={18} />
              </button>
            </div>
            <SidebarContent collapsed={false} onNavigate={() => setMobileNav(false)} onOpenUser={() => setUserPanel(true)} />
          </aside>
        </div>
      )}

      {/* ===== 主区域 ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) setMobileNav(true)
                else setSidebarOpen(!sidebarOpen)
              }}
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500"
              aria-label="切换导航"
            >
              <Icon name="Menu" size={18} />
            </button>
            <span className="lg:hidden font-semibold text-zinc-800 text-sm truncate">工作台</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500" aria-label="通知">
              <Icon name="Bell" size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* ===== 用户面板（底部上弹） ===== */}
      {userPanel && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setUserPanel(false)} />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 拖拽指示条 */}
            <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto mt-3" />

            {/* 用户信息 */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3">
              <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-indigo-700 font-medium">{user?.name?.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-800 truncate">{user?.name}</p>
                <p className="text-xs text-zinc-400">{user?.role}</p>
              </div>
              <button
                onClick={() => setUserPanel(false)}
                className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400"
                aria-label="关闭"
              >
                <Icon name="X" size={18} />
              </button>
            </div>

            {/* 操作区 */}
            <div className="px-3 pb-3 space-y-1">
              <button
                onClick={() => { setUserPanel(false); softRefresh() }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors"
              >
                <span className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-base">🔄</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-zinc-800">刷新页面</p>
                  <p className="text-[11px] text-zinc-400">重新加载当前页面（等同 F5）</p>
                </div>
              </button>

              <button
                onClick={() => { setUserPanel(false); handleHardRefresh() }}
                disabled={refreshing}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                <span className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-base">🧹</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-zinc-800">清理缓存并刷新</p>
                  <p className="text-[11px] text-zinc-400">{refreshing ? '清理中...' : '清除 PWA 缓存与 Service Worker 后重新加载（解决页面异常/版本滞留）'}</p>
                </div>
              </button>

              <button
                onClick={() => { setUserPanel(false); handleLogout() }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 transition-colors"
              >
                <span className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-base">🚪</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-red-600">退出登录</p>
                  <p className="text-[11px] text-zinc-400">退出当前账号</p>
                </div>
              </button>
            </div>

            {/* 版本信息 */}
            <div className="px-5 py-3 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-[10px] text-zinc-300">个人工作台</span>
              <span className="text-[10px] text-zinc-300">v1.0.0 · PWA</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== PWA 更新提示 ===== */}
      <UpdatePrompt />
    </div>
  )
}
