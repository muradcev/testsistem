import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DriversPage from './pages/DriversPage'
import DriverDetailPage from './pages/DriverDetailPage'
import DriverRoutesPage from './pages/DriverRoutesPage'
import LiveMapPage from './pages/LiveMapPage'
import SurveysPage from './pages/SurveysPage'
import SettingsPage from './pages/SettingsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AppConfigPage from './pages/AppConfigPage'
import QuestionsPage from './pages/QuestionsPage'
import NotificationTemplatesPage from './pages/NotificationTemplatesPage'
import ReportsPage from './pages/ReportsPage'
import { LockClosedIcon } from '@heroicons/react/24/outline'

const GATE_PASSWORD = 'murad011270'
const GATE_KEY = 'testsistem_gate_unlocked'

function GateScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === GATE_PASSWORD) {
      sessionStorage.setItem(GATE_KEY, 'true')
      onUnlock()
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="max-w-sm w-full mx-4">
        <div className="text-center mb-8">
          <LockClosedIcon className="h-16 w-16 text-gray-500 mx-auto" />
          <h1 className="mt-4 text-xl font-medium text-gray-300">Erişim Kısıtlı</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false) }}
            placeholder="Erişim şifresi"
            className={`w-full px-4 py-3 rounded-lg bg-gray-800 border ${error ? 'border-red-500' : 'border-gray-700'} text-white placeholder-gray-500 focus:outline-none focus:border-gray-500`}
            autoFocus
          />
          {error && <p className="mt-2 text-sm text-red-500">Yanlış şifre</p>}
          <button
            type="submit"
            className="mt-4 w-full py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Giriş
          </button>
        </form>
      </div>
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

export default function App() {
  const [gateUnlocked, setGateUnlocked] = useState(false)

  useEffect(() => {
    const unlocked = sessionStorage.getItem(GATE_KEY) === 'true'
    setGateUnlocked(unlocked)
  }, [])

  if (!gateUnlocked) {
    return <GateScreen onUnlock={() => setGateUnlocked(true)} />
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="drivers/:id" element={<DriverDetailPage />} />
        <Route path="drivers/:id/routes" element={<DriverRoutesPage />} />
        <Route path="live-map" element={<LiveMapPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="surveys" element={<SurveysPage />} />
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="notification-templates" element={<NotificationTemplatesPage />} />
        <Route path="app-config" element={<AppConfigPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
