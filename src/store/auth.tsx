import { createContext, useContext, useState, useCallback, type ReactNode, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

export interface User {
  id: string
  name: string
  avatar: string
  role: string
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string, remember?: boolean) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  isAuthenticated: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check existing session
  useEffect(() => {
    fetch(`${API_BASE}/api/me`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string, remember = false) => {
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, remember }),
      })
      const data = await res.json()
      if (res.ok && data.user) {
        setUser(data.user)
        return { ok: true }
      }
      return { ok: false, error: data.error || '登录失败' }
    } catch {
      return { ok: false, error: '无法连接到服务器' }
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export { API_BASE }
