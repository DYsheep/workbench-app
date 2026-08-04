import { useState } from 'react'
import { API_BASE } from '../store/auth'
import { fetchDrug as fetchMockDrug } from '../data/drugsMock'
import type { DrugInfo } from '../data/drugsMock'

// ============================================================
// 门诊用药 - 药品查询（万维易源真实数据）
// 后端代理：/api/drugs/search → 本地索引 + drugDetail 详情
// 后端不可达时自动降级为 mock 数据
// ============================================================

const HOT = ['阿莫西林', '布洛芬', '阿奇霉素', '二甲双胍', '氯雷他定']

function SectionBlock({ icon, title, color, bg, border, children }: {
  icon: string; title: string; color: string; bg: string; border: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold" style={{ color }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function ListItems({ items, color }: { items: string[]; color: string }) {
  if (!items || items.length === 0) return <p className="text-xs text-zinc-400">数据源未提供</p>
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-zinc-700 leading-relaxed">
          <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: color }} />
          {item}
        </li>
      ))}
    </ul>
  )
}

interface Candidate { drug_id: string; drug_name: string; manu: string; pzwh: string; classify_name: string }

export function DrugsPage() {
  const [keyword, setKeyword] = useState('')
  const [drug, setDrug] = useState<DrugInfo | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [usingMock, setUsingMock] = useState(false)
  const [needIndex, setNeedIndex] = useState(false)
  const [building, setBuilding] = useState(false)
  const [indexProgress, setIndexProgress] = useState('')

  const handleSearch = async (kw?: string) => {
    const q = kw || keyword
    if (!q.trim()) return
    setLoading(true)
    setError('')
    setDrug(null)
    setCandidates([])
    setNeedIndex(false)
    try {
      const res = await fetch(`${API_BASE}/api/drugs/search?q=${encodeURIComponent(q.trim())}`, { credentials: 'include' })
      const data = await res.json()
      if (data.needIndex) {
        setNeedIndex(true)
        setError(data.message)
      } else if (data.data) {
        setDrug(data.data.detail)
        setCandidates(data.data.candidates || [])
      } else {
        setError(data.message || '未找到该药品')
      }
    } catch {
      // 后端不可达 → mock 兜底
      const mock = await fetchMockDrug(q)
      setUsingMock(true)
      if (mock) setDrug(mock)
      else setError('查询失败，且演示数据中未找到该药品')
    }
    setLoading(false)
  }

  const handleBuildIndex = async () => {
    setBuilding(true)
    setIndexProgress('正在建立索引...')
    try {
      await fetch(`${API_BASE}/api/drugs/build-index`, { method: 'POST', credentials: 'include' })
      // 轮询状态
      const timer = setInterval(async () => {
        const res = await fetch(`${API_BASE}/api/drugs/index-status`, { credentials: 'include' })
        const d = await res.json()
        const s = d.data || {}
        setIndexProgress(`索引构建中 ${s.builtClassifies}/${s.totalClassifies} 分类...`)
        if (!s.building) {
          clearInterval(timer)
          setBuilding(false)
          setNeedIndex(false)
          setIndexProgress(`索引就绪（${s.dbCount} 种药品）`)
          setTimeout(() => setIndexProgress(''), 3000)
          handleSearch()
        }
      }, 2000)
    } catch {
      setBuilding(false)
      setIndexProgress('构建失败，请检查后端与网络')
    }
  }

  const handleSelectCandidate = async (cand: Candidate) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/drugs/detail?drugId=${encodeURIComponent(cand.drug_id)}`, { credentials: 'include' })
      const data = await res.json()
      if (data.data) setDrug(data.data)
      else setError(data.message || '获取详情失败')
    } catch {
      setError('获取详情失败')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800">门诊用药</h2>
        <span className="text-[10px] text-zinc-400">{usingMock ? '数据源：本地演示（后端不可达）' : '数据源：万维易源'}</span>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 mb-6 shadow-sm">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">💊</span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入药品名称，如：阿莫西林、布洛芬..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              autoFocus
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !keyword.trim()}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {loading ? '查询中...' : '查询'}
          </button>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {HOT.map((name) => (
            <button
              key={name}
              onClick={() => { setKeyword(name); handleSearch(name) }}
              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Index build prompt */}
      {needIndex && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm mb-4">
          <div className="flex items-center gap-2">
            <span>🗄️</span>
            <div className="flex-1">
              <p className="font-medium">药品索引尚未建立</p>
              <p className="text-xs mt-0.5">首次使用需从万维易源拉取药品目录（约 5000+ 种，需 1-2 分钟）</p>
              {indexProgress && <p className="text-xs mt-1 text-amber-500">{indexProgress}</p>}
            </div>
            <button
              onClick={handleBuildIndex}
              disabled={building}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors shrink-0"
            >
              {building ? '构建中...' : '建立索引'}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-zinc-400">正在查询...</p>
        </div>
      )}

      {error && !needIndex && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {drug && (
        <div>
          {/* Header card */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 mb-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl shrink-0">💊</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-zinc-800">{drug.name}</h3>
                  {drug.spec && <span className="text-[11px] px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 font-medium border border-cyan-100">📦 {drug.spec}</span>}
                  {drug.category && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{drug.category}</span>}
                </div>
                <div className="text-xs text-zinc-400 mt-1.5 space-x-3">
                  {drug.genericName && <span>通用名：{drug.genericName}</span>}
                  {drug.pzwh && <span>{drug.pzwh}</span>}
                </div>
                {drug.manu && <p className="text-[11px] text-zinc-400 mt-1">🏭 {drug.manu}</p>}
              </div>
            </div>
            {drug.note && (
              <div className="mt-3 pt-3 border-t border-zinc-100 flex gap-2 text-xs text-amber-700">
                <span className="shrink-0">⚠️</span>
                <p className="leading-relaxed">{drug.note}</p>
              </div>
            )}
          </div>

          {/* Candidates */}
          {candidates.length > 1 && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-3 mb-4 shadow-sm">
              <p className="text-[10px] text-zinc-400 mb-2">同名药品（{candidates.length} 个）</p>
              <div className="flex flex-col gap-1.5">
                {candidates.map((c) => (
                  <button
                    key={c.drug_id}
                    onClick={() => handleSelectCandidate(c)}
                    className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${drug.id === c.drug_id ? 'bg-indigo-50 text-indigo-700' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'}`}
                  >
                    <span className="font-medium">{c.drug_name}</span>
                    <span className="text-zinc-400 ml-2">{c.manu}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sections */}
          <div className="grid gap-3 mb-4">
            <SectionBlock icon="🩺" title="适应症" color="#185FA5" bg="#f0f7ff" border="#d0e6f8">
              <ListItems items={drug.indications} color="#185FA5" />
            </SectionBlock>

            <SectionBlock icon="💉" title="用法用量" color="#0F6E56" bg="#f0faf6" border="#cdeee3">
              <p className="text-sm text-zinc-700 leading-relaxed">{drug.dosage || '数据源未提供'}</p>
            </SectionBlock>

            <SectionBlock icon="🤒" title="不良反应" color="#A32D2D" bg="#fef5f5" border="#f8d7d7">
              <ListItems items={drug.adverseReactions} color="#E24B4A" />
            </SectionBlock>

            <SectionBlock icon="🚫" title="禁忌症" color="#A32D2D" bg="#fef2f2" border="#f9c6c6">
              <ListItems items={drug.contraindications} color="#E24B4A" />
            </SectionBlock>

            <SectionBlock icon="👥" title="特殊人群用药" color="#534AB7" bg="#f5f4fe" border="#dddaf8">
              {drug.specialGroups.length === 0 ? (
                <p className="text-xs text-zinc-400">数据源未提供</p>
              ) : (
                <div className="space-y-2">
                  {drug.specialGroups.map((g, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 font-medium whitespace-nowrap h-fit mt-0.5">
                        {g.group}
                      </span>
                      <p className="text-sm text-zinc-700 leading-relaxed">{g.advice}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionBlock>
          </div>

          <p className="text-center text-[10px] text-zinc-300 mb-4">— 数据来自万维易源药品数据库，实际用药请遵医嘱 —</p>
        </div>
      )}
    </div>
  )
}
