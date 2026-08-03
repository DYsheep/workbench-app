import { useState, useEffect } from 'react'
import { Icon } from '../components/icons'
import { API_BASE } from '../store/auth'

interface FileItem {
  id: string
  name: string
  type: string
  size: string
  updated_at: string
}

const typeColors: Record<string, string> = {
  xlsx: 'bg-emerald-50 text-emerald-600',
  docx: 'bg-blue-50 text-blue-600',
  md: 'bg-zinc-50 text-zinc-600',
  pdf: 'bg-red-50 text-red-600',
  txt: 'bg-amber-50 text-amber-600',
}

const typeLabels: Record<string, string> = {
  xlsx: '表格', docx: '文档', md: 'Markdown', pdf: 'PDF', txt: '文本',
}

export function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/files`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { setFiles(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-sm text-zinc-400 p-8">加载中...</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800">文件管理</h2>
      </div>

      <div className="relative mb-4">
        <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索文件..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 text-xs font-medium text-zinc-500 grid grid-cols-12 gap-4">
          <span className="col-span-6">文件名</span>
          <span className="col-span-2">类型</span>
          <span className="col-span-2">大小</span>
          <span className="col-span-2">更新时间</span>
        </div>
        <div className="divide-y divide-zinc-50">
          {filtered.map((file) => (
            <div key={file.id} className="px-5 py-3 grid grid-cols-12 gap-4 items-center hover:bg-zinc-50 transition-colors cursor-pointer">
              <div className="col-span-6 flex items-center gap-3 min-w-0">
                <Icon name="FileText" size={16} className="text-zinc-400 shrink-0" />
                <span className="text-sm text-zinc-800 truncate">{file.name}</span>
              </div>
              <span className="col-span-2">
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${typeColors[file.type] || 'bg-zinc-50 text-zinc-500'}`}>
                  {typeLabels[file.type] || file.type}
                </span>
              </span>
              <span className="col-span-2 text-xs text-zinc-500">{file.size}</span>
              <span className="col-span-2 text-xs text-zinc-400">{file.updated_at}</span>
            </div>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-zinc-400 text-sm">没有找到匹配的文件</div>
      )}
    </div>
  )
}
