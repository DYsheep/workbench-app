import { useState, useEffect } from 'react'
import { Icon } from '../components/icons'
import { API_BASE } from '../store/auth'
import { Link } from 'react-router-dom'

// Quick check for today's reminders
function getTodayReminders(): { type: 'birthday'; name: string; relation: string }[] {
  try {
    const raw = localStorage.getItem('wb_relations_v3')
    if (!raw) return []
    const data = JSON.parse(raw)
    const allPeople: any[] = []
    for (const cat of ['family','friendship','love']) {
      const catData = data[cat]
      if (Array.isArray(catData)) allPeople.push(...catData)
      else if (catData?.people) allPeople.push(...catData.people)
    }
    const today = new Date()
    const mmdd = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const reminders: ReturnType<typeof getTodayReminders> = []

    for (const p of allPeople) {
      if (p.birthday === mmdd) {
        reminders.push({ type: 'birthday', name: p.name, relation: p.relationship })
      }
    }
    return reminders
  } catch { return [] }
}

function TodayReminders() {
  const [reminders, setReminders] = useState(getTodayReminders())
  if (reminders.length === 0) return null
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-2">
        {reminders.map((r, i) => (
          <Link key={i} to="/relations"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-200 transition-all hover:shadow-sm"
            style={{ background: '#fef2f2' }}
          >
            <span className="text-xl">🎂</span>
            <div className="flex-1">
              <span className="text-sm font-medium" style={{ color: '#991b1b' }}>
                {r.name} {r.relation && `(${r.relation})`}
              </span>
              <span className="text-xs ml-2" style={{ color: '#dc2626' }}>
                今天生日！记得祝福
              </span>
            </div>
            <span className="text-xs text-red-500">去处理 →</span>
            <span className="text-xs" style={{ color: r.type === 'birthday' ? '#ef4444' : '#f97316' }}>去处理 →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

interface Workspace {
  id: string
  name: string
  description: string
  member_count: number
  file_count: number
  updated_at: string
  color: string
}

const colorClasses: Record<string, { bg: string; dot: string }> = {
  indigo: { bg: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
  emerald: { bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  rose: { bg: 'bg-rose-50 border-rose-200', dot: 'bg-rose-500' },
  violet: { bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500' },
}

export function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/workspaces`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { setWorkspaces(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const stats = [
    { label: '工作区', value: workspaces.length, icon: 'FolderOpen' as const, color: 'indigo' as const },
    { label: '文件', value: workspaces.reduce((s,w) => s + (w.file_count||0), 0), icon: 'FileText' as const, color: 'emerald' as const },
    { label: '活跃项目', value: workspaces.filter(w => w.member_count > 1).length, icon: 'Users' as const, color: 'amber' as const },
  ]

  const colorMap = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'text-amber-500' },
  }

  if (loading) {
    return <div className="text-sm text-zinc-400 p-8">加载中...</div>
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6">仪表盘</h2>

      <TodayReminders />

      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => {
          const c = colorMap[stat.color]
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-500">{stat.label}</span>
                <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <Icon name={stat.icon} size={18} className={c.icon} />
                </div>
              </div>
              <p className={`text-2xl font-semibold ${c.text}`}>{stat.value}</p>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-800">最近活动</h3>
        </div>
        <div className="divide-y divide-zinc-50">
          {workspaces.slice(0, 8).map((ws) => {
            const c = colorClasses[ws.color] || colorClasses.indigo
            return (
              <div key={ws.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-zinc-50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500`}>
                  <Icon name="FolderOpen" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <p className="text-sm text-zinc-800 truncate">{ws.name}</p>
                  </div>
                  <p className="text-xs text-zinc-400">{ws.updated_at}</p>
                </div>
                <span className="text-xs text-zinc-400">{ws.file_count || 0} 文件</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
