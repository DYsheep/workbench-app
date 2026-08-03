import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/auth'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { WorkspacesPage, WorkspaceDetailPage } from './pages/Workspaces'
import { FilesPage } from './pages/Files'
import { DrugsPage } from './pages/Drugs'
import { KalimbaPage } from './pages/Kalimba'
import { PlansPage } from './pages/Plans'
import { RelationsPage } from './pages/Relations'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/workspaces/:id" element={<WorkspaceDetailPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/drugs" element={<DrugsPage />} />
            <Route path="/kalimba" element={<KalimbaPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/relations" element={<RelationsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
