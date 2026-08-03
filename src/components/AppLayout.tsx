import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Icon } from './icons'
import { useState } from 'react'

const NAV_ITEMS = [
  { to: '/', label: '仪表盘', icon: 'LayoutDashboard' as const },
  { to: '/workspaces', label: '工作区', icon: 'FolderOpen' as const },
  { to: '/files', label: '文件管理', icon: 'FileText' as const },
  { to: '/drugs', label: '用药查询', icon: 'Pill' as const },
  { to: '/kalimba', label: '拇指琴', icon: 'Music' as const },
  { to: '/plans', label: '我的计划', icon: 'Calendar' as const },
  { to: '/relations', label: '关系疏离', icon: 'Heart' as const },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-60' : 'w-16'
        } bg-white border-r border-zinc-200 flex flex-col transition-all duration-200 shrink-0`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-zinc-100">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white font-semibold text-sm">W</span>
          </div>
          {sidebarOpen && (
            <span className="ml-3 font-semibold text-zinc-800 text-sm">工作台</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`
              }
            >
              <Icon name={item.icon} size={18} />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-zinc-100 p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="text-indigo-700 font-medium text-xs">
                {user?.name?.charAt(0)}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800 truncate">{user?.name}</p>
                <p className="text-xs text-zinc-400">{user?.role}</p>
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
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500"
          >
            <Icon name="Menu" size={18} />
          </button>
          <div className="flex items-center gap-3">
            <button className="relative p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500">
              <Icon name="Bell" size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
