import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Icon } from './icons'
import { useState } from 'react'

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

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = ({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) => (
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

      {/* User */}
      <div className="border-t border-zinc-100 p-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-indigo-700 font-medium text-xs">
              {user?.name?.charAt(0)}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800 truncate">{user?.name}</p>
              <p className="text-xs text-zinc-400 truncate">{user?.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400 shrink-0"
            title="退出登录"
          >
            <Icon name="LogOut" size={16} />
          </button>
        </div>
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
        <SidebarContent collapsed={!sidebarOpen} />
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
            <SidebarContent collapsed={false} onNavigate={() => setMobileNav(false)} />
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
    </div>
  )
}
