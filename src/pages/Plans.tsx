import { useState, useEffect, useCallback, useMemo } from 'react'

// ============================================================
// Types & Data
// ============================================================
interface Task { id: number; text: string; done: boolean }
interface DayPlan { tasks: Task[]; notes: string }

const DAILY_TEMPLATES: Task[] = [
  { id: 1, text: '练习拇指琴 15 分钟', done: false },
  { id: 2, text: '阅读 30 分钟', done: false },
  { id: 3, text: '运动 20 分钟', done: false },
  { id: 4, text: '写今日待办总结', done: false },
]

function todayKey(): string { return new Date().toISOString().slice(0, 10) }
function loadPlans(): Record<string, DayPlan> {
  try { return JSON.parse(localStorage.getItem('wb_plans') || '{}') } catch { return {} }
}
function savePlans(plans: Record<string, DayPlan>) {
  localStorage.setItem('wb_plans', JSON.stringify(plans))
}

// ============================================================
// Visual helpers
// ============================================================
const CHECK_ANIM = `@keyframes checkPop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.3);opacity:1}100%{transform:scale(1);opacity:1}}`
const STRIKE_ANIM = `@keyframes strikeThrough{from{width:0}to{width:100%}}`
const SPARK_ANIM = `@keyframes sparkUp{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-60px) scale(0);opacity:0}}`
const BOUNCE_ANIM = `@keyframes bounce{0%,100%{transform:scale(1)}30%{transform:scale(1.3)}}`
const RING_ANIM = `@keyframes ringFill{from{stroke-dashoffset:283}to{stroke-dashoffset:var(--ring-offset)}}`

function ProgressRing({ pct, size = 60 }: { pct: number; size?: number }) {
  const r = 22; const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)
  const stroke = pct === 100 ? '#10b981' : pct >= 50 ? '#6366f1' : '#d4d4d8'
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#e4e4e7" strokeWidth="3" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={stroke} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s' }}
          transform="rotate(-90 30 30)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-zinc-600"
        style={{ animation: pct === 100 ? 'bounce 0.4s ease' : 'none' }}>
        {pct}%
      </span>
    </div>
  )
}

function Sparkles({ active }: { active: boolean }) {
  if (!active) return null
  const sparks = Array.from({ length: 8 }, (_, i) => ({
    id: i, x: Math.cos(i * Math.PI / 4) * 30 + 50,
    y: Math.sin(i * Math.PI / 4) * 30 + 50, delay: i * 0.05,
  }))
  return (
    <div className="absolute inset-0 pointer-events-none">
      {sparks.map(s => (
        <div key={s.id} style={{
          position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
          width: 6, height: 6, borderRadius: 3,
          background: ['#fbbf24', '#34d399', '#60a5fa', '#f472b6'][s.id % 4],
          animation: `sparkUp 0.6s ${s.delay}s ease-out forwards`,
        }} />
      ))}
    </div>
  )
}

// ============================================================
// Year heatmap
// ============================================================
function YearHeatmap({ plans }: { plans: Record<string, DayPlan> }) {
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
  const today = new Date(); const year = today.getFullYear()
  const daysInYear = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(year, 0, i + 1)
    return { date: d.toISOString().slice(0, 10), dayOfWeek: d.getDay() }
  })
  const firstDay = new Date(year, 0, 1).getDay()
  const weeks: (typeof daysInYear[0] | null)[][] = []
  let week: (typeof daysInYear[0] | null)[] = Array(firstDay).fill(null)
  for (const d of daysInYear) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week) }

  const color = (key: string) => {
    const p = plans[key]
    if (!p) return '#f4f4f5'
    const tasks = p.tasks.length || DAILY_TEMPLATES.length
    const done = p.tasks.filter(t => t.done).length
    const rate = done / (tasks || 1)
    if (rate >= 1) return '#22c55e'
    if (rate >= 0.75) return '#86efac'
    if (rate >= 0.5) return '#bbf7d0'
    if (rate > 0) return '#dcfce7'
    return '#fee2e2'
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-1" style={{ minWidth: 740 }}>
        <div className="flex flex-col gap-1 pr-2 pt-5">
          {['日','一','二','三','四','五','六'].slice(0, 7).map((d, i) => (
            <div key={i} className="text-[9px] text-zinc-400 leading-4 w-4 text-right">{d}</div>
          ))}
        </div>
        <div>
          <div className="flex gap-6 mb-1">
            {months.map((m, i) => (
              <span key={i} className="text-[10px] text-zinc-400">{m}</span>
            ))}
          </div>
          <div className="flex gap-[2px]">
            {weeks.map((w, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {w.map((d, di) => (
                  <div key={di} title={d?.date || ''} style={{
                    width: 12, height: 12, borderRadius: 2, background: d ? color(d.date) : 'transparent',
                    outline: d && d.date === todayKey() ? '1.5px solid #6366f1' : 'none',
                    outlineOffset: 1,
                  }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-zinc-400 items-center">
        <span>少</span>
        {['#f4f4f5','#dcfce7','#bbf7d0','#86efac','#22c55e'].map(c => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
        ))}
        <span>多</span>
      </div>
    </div>
  )
}

// ============================================================
// Month view
// ============================================================
function MonthCalendar({ plans, onSelect }: { plans: Record<string, DayPlan>; onSelect: (d: string) => void }) {
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const today = todayKey()

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(viewYear, viewMonth, i + 1)
    return d.toISOString().slice(0, 10)
  })

  const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }}
          className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1">←</button>
        <span className="text-sm font-semibold text-zinc-700">{viewYear}年 {monthNames[viewMonth]}</span>
        <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }}
          className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['日','一','二','三','四','五','六'].map(d => (
          <div key={d} className="text-[10px] text-zinc-400 py-1">{d}</div>
        ))}
        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {days.map(d => {
          const plan = plans[d]
          const tasks = plan?.tasks || DAILY_TEMPLATES
          const done = tasks.filter(t => t.done).length
          const total = tasks.length
          const isToday = d === today
          const bg = !plan ? 'bg-zinc-50' : done === total ? 'bg-emerald-50 border-emerald-200' : done > 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-zinc-50'
          return (
            <button key={d} onClick={() => onSelect(d)} className={`text-xs rounded-lg border py-2 hover:border-zinc-300 transition-colors ${bg} ${isToday ? 'ring-2 ring-indigo-300' : 'border-transparent'}`}>
              <div className="font-medium text-zinc-600">{new Date(d).getDate()}</div>
              {plan && <div className="text-[8px] text-zinc-400 mt-0.5">{done}/{total}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Day view — the core interactive experience
// ============================================================
function DayView({ date, plan, onToggle, onAdd, onDelete }: {
  date: string; plan: DayPlan | undefined;
  onToggle: (taskId: number) => void;
  onAdd: (text: string) => void;
  onDelete: (taskId: number) => void;
}) {
  const [newText, setNewText] = useState('')
  const [sparkle, setSparkle] = useState(false)
  const tasks = plan?.tasks || DAILY_TEMPLATES
  const done = tasks.filter(t => t.done).length
  const total = tasks.length
  const pct = Math.round((done / total) * 100)
  const allDone = done === total && total > 0

  const handleToggle = (taskId: number) => {
    onToggle(taskId)
    if (!tasks.find(t => t.id === taskId)?.done) {
      setSparkle(true)
      setTimeout(() => setSparkle(false), 700)
    }
  }

  const isToday = date === todayKey()
  const dateLabel = isToday ? '今天' : date.slice(5)

  return (
    <div>
      {/* Day header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-zinc-800">{dateLabel}</span>
          {isToday && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">今天</span>}
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing pct={pct} size={48} />
          <div className="text-right">
            <div className="text-xs text-zinc-400">{done}/{total}</div>
            {allDone && <div className="text-[10px] text-emerald-500 font-medium">全部完成！</div>}
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-1">
        {tasks.map(task => (
          <div key={task.id} className="relative overflow-hidden">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-colors ${
              task.done ? 'bg-emerald-50/50' : 'bg-zinc-50 hover:bg-zinc-100'
            }`}>
              {/* Checkbox */}
              <button onClick={() => handleToggle(task.id)} className="relative shrink-0">
                <div style={{
                  width: 22, height: 22, borderRadius: 7,
                  border: `2px solid ${task.done ? '#10b981' : '#d4d4d8'}`,
                  background: task.done ? '#10b981' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}>
                  {task.done && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      style={{ animation: 'checkPop 0.25s ease' }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
              {/* Text */}
              <span className={`text-sm flex-1 transition-all duration-300 ${
                task.done ? 'text-zinc-400 line-through' : 'text-zinc-700'
              }`}>
                {task.text}
              </span>
              {/* Delete */}
              {plan && plan.tasks.length > 4 && (
                <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-[10px] text-zinc-400 hover:text-red-400 transition-all px-1">
                  ✕
                </button>
              )}
            </div>
            <Sparkles active={sparkle && task.done} />
          </div>
        ))}
      </div>

      {/* Add task */}
      <form onSubmit={e => { e.preventDefault(); if (newText.trim()) { onAdd(newText.trim()); setNewText('') } }}
        className="flex gap-2 mt-3">
        <input value={newText} onChange={e => setNewText(e.target.value)} placeholder="添加新任务..."
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-indigo-300 focus:bg-white transition-colors" />
        <button type="submit" disabled={!newText.trim()}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          添加
        </button>
      </form>

      {/* All done celebration */}
      {allDone && (
        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center"
          style={{ animation: 'checkPop 0.4s ease' }}>
          <div className="text-2xl mb-1">🎯</div>
          <div className="text-sm font-semibold text-emerald-700">太棒了，今天全部完成！</div>
          <div className="text-xs text-emerald-500 mt-0.5">保持这个节奏，你是最棒的</div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main component
// ============================================================
export function PlansPage() {
  const [plans, setPlans] = useState<Record<string, DayPlan>>(loadPlans)
  const [view, setView] = useState<'year' | 'month' | 'day'>('day')
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [streak, setStreak] = useState(0)

  // Calculate streak
  useEffect(() => {
    let s = 0; const d = new Date()
    while (true) {
      const key = d.toISOString().slice(0, 10)
      const plan = plans[key]
      if (!plan) break
      const tasks = plan.tasks.length ? plan.tasks : DAILY_TEMPLATES
      if (tasks.every(t => t.done)) { s++; d.setDate(d.getDate() - 1) }
      else break
    }
    setStreak(s)
  }, [plans])

  const todayPlan = plans[selectedDate]
  const plan = todayPlan || { tasks: DAILY_TEMPLATES.map(t => ({ ...t })), notes: '' }

  const toggleTask = useCallback((taskId: number) => {
    setPlans(prev => {
      const k = selectedDate
      const existing = prev[k]
      const tasks = existing?.tasks?.length ? [...existing.tasks] : DAILY_TEMPLATES.map(t => ({ ...t }))
      const idx = tasks.findIndex(t => t.id === taskId)
      if (idx >= 0) {
        tasks[idx] = { ...tasks[idx], done: !tasks[idx].done }
      } else {
        tasks.push({ id: taskId, text: '', done: true })
      }
      const next = { ...prev, [k]: { ...(existing || { notes: '' }), tasks } }
      savePlans(next)
      return next
    })
  }, [selectedDate])

  const addTask = useCallback((text: string) => {
    setPlans(prev => {
      const k = selectedDate
      const existing = prev[k]
      const tasks = [...(existing?.tasks || DAILY_TEMPLATES.map(t => ({ ...t })))]
      const maxId = tasks.reduce((m, t) => Math.max(m, t.id), 0)
      tasks.push({ id: maxId + 1, text, done: false })
      const next = { ...prev, [k]: { ...(existing || { notes: '' }), tasks } }
      savePlans(next)
      return next
    })
  }, [selectedDate])

  const deleteTask = useCallback((taskId: number) => {
    setPlans(prev => {
      const k = selectedDate
      const existing = prev[k]
      if (!existing) return prev
      const tasks = existing.tasks.filter(t => t.id !== taskId)
      const next = { ...prev, [k]: { ...existing, tasks } }
      savePlans(next)
      return next
    })
  }, [selectedDate])

  const switchTab = (v: 'year' | 'month' | 'day') => {
    setView(v)
    if (v === 'day') setSelectedDate(todayKey())
  }

  const activeDays = Object.keys(plans).length
  const monthKey = todayKey().slice(0, 7)
  const monthDone = Object.entries(plans)
    .filter(([k]) => k.startsWith(monthKey))
    .reduce((c, [_, p]) => {
      const t = p.tasks.length ? p.tasks : DAILY_TEMPLATES
      return c + t.filter(x => x.done).length
    }, 0)

  return (
    <div className="max-w-4xl">
      <style>{CHECK_ANIM}{STRIKE_ANIM}{SPARK_ANIM}{BOUNCE_ANIM}{RING_ANIM}</style>

      {/* Header stats */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-800">我的计划</h2>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            连续 {streak} 天
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            本月完成 {monthDone}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {activeDays} 天活跃
          </span>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 mb-6 w-fit">
        {[
          { id: 'day' as const, label: '日计划' },
          { id: 'month' as const, label: '月概览' },
          { id: 'year' as const, label: '年热力图' },
        ].map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === t.id ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* View content */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        {view === 'year' && <YearHeatmap plans={plans} />}

        {view === 'month' && (
          <MonthCalendar plans={plans} onSelect={(d) => { setSelectedDate(d); setView('day') }} />
        )}

        {view === 'day' && (
          <DayView date={selectedDate} plan={todayPlan} onToggle={toggleTask} onAdd={addTask} onDelete={deleteTask} />
        )}
      </div>
    </div>
  )
}
