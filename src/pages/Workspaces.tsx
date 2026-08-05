import { useState, useEffect } from 'react'
import { Icon } from '../components/icons'
import { API_BASE } from '../store/auth'

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

export function WorkspacesPage() {
  const [list, setList] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const fetchList = () => {
    fetch(`${API_BASE}/api/workspaces`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { setList(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchList() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const res = await fetch(`${API_BASE}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newName, description: newDesc }),
    })
    if (res.ok) {
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      fetchList()
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`${API_BASE}/api/workspaces/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    fetchList()
  }

  if (loading) return <div className="text-sm text-zinc-400 p-8">加载中...</div>

  return (
    <div className="max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-800">工作区</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Icon name="Plus" size={16} />新建工作区
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl border border-zinc-200 p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-zinc-800 mb-4">新建工作区</h3>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="工作区名称" className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="描述（可选）" rows={3} className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100">取消</button>
              <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700">创建</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {list.map((ws) => {
          const c = colorClasses[ws.color] || colorClasses.indigo
          return (
            <div key={ws.id} className={`bg-white rounded-xl border ${c.bg} p-5`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    <h3 className="text-sm font-semibold text-zinc-800">{ws.name}</h3>
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">{ws.description}</p>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-zinc-400 flex items-center gap-1"><Icon name="Users" size={13} /> {ws.member_count} 人</span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1"><Icon name="FileText" size={13} /> {ws.file_count} 文件</span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1"><Icon name="Clock" size={13} /> {ws.updated_at}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(ws.id)} className="p-1.5 rounded-md hover:bg-white/50 text-zinc-400 hover:text-red-500 transition-colors">
                  <Icon name="X" size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WorkspaceDetailPage() {
  return (
    <div className="max-w-screen-2xl mx-auto w-full">
      <button onClick={() => window.history.back()} className="text-sm text-indigo-600 hover:text-indigo-700 mb-4 flex items-center gap-1">← 返回</button>
      <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center">
        <Icon name="FolderOpen" size={40} className="mx-auto mb-3 text-zinc-300" />
        <p className="text-zinc-500 text-sm">工作区详情（后续实现）</p>
      </div>
    </div>
  )
}
