import { useState, useEffect } from 'react'
import { API_BASE } from '../store/auth'
import { fetchDrug as fetchMockDrug } from '../data/drugsMock'
import type { DrugInfo } from '../data/drugsMock'

// ============================================================
// 门诊用药 - 药品查询（万维易源真实数据）
// 后端代理：/api/drugs/search → 本地索引 + drugDetail 详情
// 后端不可达时自动降级为 mock 数据
// ============================================================

const HOT = ['阿莫西林', '布洛芬', '阿奇霉素', '二甲双胍', '氯雷他定']

// 折叠列表：默认显示前 N 条，超出可展开
function CollapseList({ items, color, initial = 3 }: { items: string[]; color: string; initial?: number }) {
  const [expanded, setExpanded] = useState(false)
  if (!items || items.length === 0) return <p className="text-xs text-zinc-400">数据源未提供</p>
  const shown = expanded ? items : items.slice(0, initial)
  const hidden = items.length - shown.length
  return (
    <ul className="space-y-1.5">
      {shown.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-zinc-700 leading-relaxed">
          <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: color }} />
          <span>{item}</span>
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium mt-1 hover:opacity-70 transition-opacity"
            style={{ color }}
          >
            {expanded ? '▴ 收起' : `▾ 展开全部 ${items.length} 条`}
          </button>
        </li>
      )}
    </ul>
  )
}

interface Candidate { drug_id: string; drug_name: string; manu: string; pzwh: string; classify_name: string }

// ============================================================
// 同名候选弹窗：滚动查看全部 + 模糊搜索（药名/厂家）
// ============================================================
function CandidateModal({ candidates, currentId, onSelect, onClose }: {
  candidates: Candidate[]
  currentId: string
  onSelect: (c: Candidate) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(-1) // 键盘上下键索引

  // Esc 关闭
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const filtered = query.trim()
    ? candidates.filter(c =>
        c.drug_name.toLowerCase().includes(query.trim().toLowerCase()) ||
        c.manu.toLowerCase().includes(query.trim().toLowerCase())
      )
    : candidates

  const handleSelect = (c: Candidate) => { onSelect(c); onClose() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div
        className="bg-white rounded-xl w-full max-w-lg flex flex-col max-h-[75vh] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 shrink-0">
          <h3 className="text-sm font-semibold text-zinc-800">
            同名药品 <span className="text-zinc-400 font-normal">共 {candidates.length} 个</span>
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400" aria-label="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-4 py-2.5 border-b border-zinc-100 shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索药名或厂家..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              autoFocus
            />
          </div>
        </div>

        {/* 列表（可滚动） */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 py-8">没有匹配「{query}」的药品</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.drug_id}
                  onClick={() => handleSelect(c)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-3 ${
                    currentId === c.drug_id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-zinc-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${currentId === c.drug_id ? 'text-indigo-700 font-medium' : 'text-zinc-800'}`}>
                      {c.drug_name}
                    </p>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {c.manu}{c.pzwh ? ` · ${c.pzwh}` : ''}
                    </p>
                  </div>
                  {currentId === c.drug_id && (
                    <span className="text-[10px] text-indigo-600 shrink-0">当前 ✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 底部统计 */}
        <div className="px-4 py-2 border-t border-zinc-100 text-[11px] text-zinc-400 shrink-0">
          显示 {filtered.length} / {candidates.length} 个，点击切换药品
        </div>
      </div>
    </div>
  )
}

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
  const [candModal, setCandModal] = useState(false)

  const handleSearch = async (kw?: string) => {
    const q = kw || keyword
    if (!q.trim()) return
    setLoading(true)
    setError('')
    setDrug(null)
    setCandidates([])
    setCandModal(false)
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
    <div className="max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800">门诊用药</h2>
        <span className="text-[10px] text-zinc-400">{usingMock ? '数据源：本地演示（后端不可达）' : '数据源：万维易源'}</span>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 mb-6">
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
          {/* ===== 头卡：元信息 + 警示条 ===== */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl shrink-0">💊</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-zinc-800">{drug.name}</h3>
                  {drug.spec && <span className="text-[11px] px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 font-medium border border-cyan-100">📦 {drug.spec}</span>}
                  {drug.category && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{drug.category}</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-zinc-500">
                  {drug.genericName && <span>通用名：<span className="text-zinc-700">{drug.genericName}</span></span>}
                  {drug.pzwh && <span>批准文号：<span className="text-zinc-700">{drug.pzwh}</span></span>}
                  {drug.manu && <span>厂家：<span className="text-zinc-700">{drug.manu}</span></span>}
                </div>
              </div>
            </div>

            {/* 禁忌警示条（前置，一眼可见） */}
            {drug.contraindications.length > 0 && (
              <div className="mt-3 flex gap-2.5 rounded-xl bg-red-50 border border-red-100 p-3">
                <span className="text-base shrink-0 mt-0.5">🚫</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-red-700 mb-0.5">禁忌</p>
                  <p className="text-xs text-red-600 leading-relaxed line-clamp-2">{drug.contraindications.join('；')}</p>
                </div>
              </div>
            )}

            {/* 注意事项警示条 */}
            {drug.note && (
              <div className="mt-2 flex gap-2.5 rounded-xl bg-amber-50 border border-amber-100 p-3">
                <span className="text-base shrink-0 mt-0.5">⚠️</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">注意事项</p>
                  <p className="text-xs text-amber-700/80 leading-relaxed line-clamp-2">{drug.note}</p>
                </div>
              </div>
            )}
          </div>

          {/* ===== 同名候选切换 ===== */}
          {candidates.length > 1 && (
            <div className="bg-white rounded-xl border border-zinc-200 p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-zinc-400">
                  同名药品共 <span className="text-zinc-600 font-medium">{candidates.length}</span> 个（不同厂家/剂型）
                </p>
                {candidates.length > 10 && (
                  <button
                    onClick={() => setCandModal(true)}
                    className="text-[10px] font-medium text-indigo-600 hover:text-indigo-700 shrink-0"
                  >
                    查看全部 {candidates.length} 个 ›
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {candidates.slice(0, 10).map((c) => (
                  <button
                    key={c.drug_id}
                    onClick={() => handleSelectCandidate(c)}
                    className={`text-left px-3 py-2 rounded-lg text-xs transition-colors shrink-0 max-w-52 ${
                      drug.id === c.drug_id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <span className="font-medium block truncate">{c.drug_name}</span>
                    <span className="text-zinc-400 text-[10px] block truncate">{c.manu}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== 同名候选弹窗 ===== */}
          {candModal && (
            <CandidateModal
              candidates={candidates}
              currentId={drug.id}
              onSelect={handleSelectCandidate}
              onClose={() => setCandModal(false)}
            />
          )}

          {/* ===== 主体：两列卡片网格 ===== */}
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            {/* 适应症（主内容） */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4 md:col-span-2">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-base">🩺</span>
                <span className="text-sm font-semibold text-zinc-700">适应症</span>
                <span className="text-[10px] text-zinc-300 font-normal">Indications</span>
              </div>
              <CollapseList items={drug.indications} color="#185FA5" initial={4} />
            </div>

            {/* 用法用量（重点卡片） */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-base">💉</span>
                <span className="text-sm font-semibold text-zinc-700">用法用量</span>
                <span className="text-[10px] text-zinc-300 font-normal">Dosage</span>
              </div>
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{drug.dosage || '数据源未提供'}</p>
            </div>

            {/* 不良反应（折叠） */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-base">🤒</span>
                <span className="text-sm font-semibold text-zinc-700">不良反应</span>
                <span className="text-[10px] text-zinc-300 font-normal">Side effects</span>
              </div>
              <CollapseList items={drug.adverseReactions} color="#BA7517" initial={2} />
            </div>

            {/* 禁忌症（完整） */}
            {drug.contraindications.length > 0 && (
              <div className="bg-white rounded-xl border border-red-100 p-4 md:col-span-2">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-base">🚫</span>
                  <span className="text-sm font-semibold text-red-700">禁忌</span>
                  <span className="text-[10px] text-zinc-300 font-normal">Contraindications</span>
                </div>
                <CollapseList items={drug.contraindications} color="#E24B4A" initial={3} />
              </div>
            )}
          </div>

          {/* ===== 特殊人群：横向小卡片 ===== */}
          {drug.specialGroups.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                <span className="text-base">👥</span> 特殊人群用药
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {drug.specialGroups.map((g, i) => (
                  <div key={i} className="bg-white rounded-xl border border-violet-100 p-3">
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 font-medium mb-1.5">
                      {g.group}
                    </span>
                    <p className="text-xs text-zinc-600 leading-relaxed line-clamp-3">{g.advice}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-[10px] text-zinc-300 mb-4">— 数据来自万维易源药品数据库，实际用药请遵医嘱 —</p>
        </div>
      )}
    </div>
  )
}
