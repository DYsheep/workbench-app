import { Icon } from '../components/icons'
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
  const reminders = getTodayReminders()
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
            <span className="text-xs" style={{ color: r.type === 'birthday' ? '#ef4444' : '#f97316' }}>去处理 →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// 模块快捷入口
const MODULES: { to: string; icon: string; label: string; desc: string; bg: string; iconBg: string }[] = [
  { to: '/drugs', icon: 'Pill', label: '门诊用药', desc: '药品查询与说明书', bg: 'bg-indigo-50 border-indigo-200', iconBg: 'bg-indigo-100 text-indigo-600' },
  { to: '/kalimba', icon: 'Music', label: '拇指琴', desc: '练习与成就打卡', bg: 'bg-emerald-50 border-emerald-200', iconBg: 'bg-emerald-100 text-emerald-600' },
  { to: '/plans', icon: 'Calendar', label: '我的计划', desc: '每日任务与打卡', bg: 'bg-amber-50 border-amber-200', iconBg: 'bg-amber-100 text-amber-600' },
  { to: '/relations', icon: 'Heart', label: '关系梳理', desc: '家人朋友生日提醒', bg: 'bg-rose-50 border-rose-200', iconBg: 'bg-rose-100 text-rose-600' },
]

export function DashboardPage() {
  return (
    <div className="max-w-screen-2xl mx-auto w-full">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6">仪表盘</h2>

      <TodayReminders />

      <p className="text-sm text-zinc-500 mb-3">快捷入口</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MODULES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className={`bg-white rounded-xl border p-5 transition-all hover:shadow-sm hover:-translate-y-0.5 ${m.bg}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${m.iconBg}`}>
              <Icon name={m.icon as any} size={20} />
            </div>
            <p className="text-sm font-semibold text-zinc-800">{m.label}</p>
            <p className="text-xs text-zinc-500 mt-1">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
