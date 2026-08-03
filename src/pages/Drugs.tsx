import { useState } from 'react'
import { Icon } from '../components/icons'
import { API_BASE } from '../store/auth'

const SUGGESTIONS = ['阿莫西林', '布洛芬', '阿奇霉素', '二甲双胍', '氯雷他定']

interface DrugResult {
  title: string
  content: string
}

export function DrugsPage() {
  const [keyword, setKeyword] = useState('')
  const [result, setResult] = useState<DrugResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (kw?: string) => {
    const q = kw || keyword
    if (!q.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(
        `${API_BASE}/api/drugs/search?q=${encodeURIComponent(q.trim())}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (data.data) {
        setResult(data.data)
      } else {
        setError(data.message || '未找到该药品')
      }
    } catch {
      setError('查询失败，请确保后端服务已启动')
    }
    setLoading(false)
  }

  const parseSections = (content: string) => {
    const sections = content.split('【')
    return sections.filter(Boolean).map((s) => {
      const idx = s.indexOf('】')
      if (idx === -1) return { title: '', body: s }
      return { title: s.slice(0, idx), body: s.slice(idx + 1).trim() }
    })
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-zinc-800 mb-6">用药查询</h2>

      <div className="bg-white rounded-xl border border-zinc-200 p-4 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Icon name="Pill" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入药品名称，如：阿莫西林、布洛芬..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !keyword.trim()}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {loading ? '查询中...' : '查询'}
          </button>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {SUGGESTIONS.map((name) => (
            <button
              key={name}
              onClick={() => { setKeyword(name); handleSearch(name) }}
              className="text-xs px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-sm flex items-center gap-2">
          <Icon name="Info" size={16} />{error}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-zinc-100">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Icon name="Pill" size={20} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-800">{result.title}</h3>
              <p className="text-xs text-zinc-400">药品说明书 · 数据来源：后端 API</p>
            </div>
          </div>
          <div className="space-y-4">
            {parseSections(result.content).map((section, i) => (
              <div key={i} className="flex gap-3">
                {section.title && (
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded whitespace-nowrap h-fit mt-0.5">
                    {section.title}
                  </span>
                )}
                <p className="text-sm text-zinc-700 leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 text-xs text-zinc-400 flex items-center gap-1">
            <Icon name="Info" size={12} />
            数据来自后端 SQLite 数据库 · 可接入天行数据 API 获取更多药品
          </div>
        </div>
      )}
    </div>
  )
}
