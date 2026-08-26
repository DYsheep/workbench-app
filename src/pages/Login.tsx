import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Icon } from '../components/icons'

// 只存用户名，永不存密码——密码填充交给浏览器密码管理器
const USERNAME_KEY = 'workbench-remember-user'

function loadRememberedUsername(): string {
  try {
    return localStorage.getItem(USERNAME_KEY) || ''
  } catch {
    return ''
  }
}

export function LoginPage() {
  const rememberedUsername = loadRememberedUsername()
  const [username, setUsername] = useState(rememberedUsername)
  const [password, setPassword] = useState('')
  const [rememberAccount, setRememberAccount] = useState(!!rememberedUsername)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(username, password, rememberMe)
    setLoading(false)

    if (result.ok) {
      if (rememberAccount) {
        localStorage.setItem(USERNAME_KEY, username)
      } else {
        localStorage.removeItem(USERNAME_KEY)
      }
      navigate('/')
    } else {
      setError(result.error || '登录失败')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <span className="text-white font-bold text-2xl">W</span>
          </div>
          <h1 className="text-xl font-semibold text-zinc-800">工作台</h1>
          <p className="text-sm text-zinc-500 mt-1">登录以继续使用</p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="on" className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm flex items-center gap-2">
              <Icon name="Info" size={16} />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-zinc-700 mb-1.5">用户名</label>
              <input
                id="login-username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoComplete="username"
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-zinc-700 mb-1.5">密码</label>
              <input
                id="login-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberAccount}
                  onChange={(e) => setRememberAccount(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                记住账号
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                30 天内免登录
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <p className="text-xs text-zinc-400 text-center mt-4">
          确保后端已启动：<code className="bg-zinc-100 px-1 py-0.5 rounded">cd server && node index.js</code>
        </p>
      </div>
    </div>
  )
}
