import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DriversPage from './pages/DriversPage'
import DriverDetailPage from './pages/DriverDetailPage'
import DriverRoutesPage from './pages/DriverRoutesPage'
import LiveMapPage from './pages/LiveMapPage'
import HeatMapPage from './pages/HeatMapPage'
import SurveysPage from './pages/SurveysPage'
import SettingsPage from './pages/SettingsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AppConfigPage from './pages/AppConfigPage'
import QuestionsPage from './pages/QuestionsPage'
import NotificationTemplatesPage from './pages/NotificationTemplatesPage'
import ReportsPage from './pages/ReportsPage'
import ErrorMonitoringPage from './pages/ErrorMonitoringPage'
import StopsPage from './pages/StopsPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

export default function App() {
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
        <Route path="heat-map" element={<HeatMapPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="error-monitoring" element={<ErrorMonitoringPage />} />
        <Route path="stops" element={<StopsPage />} />
        <Route path="surveys" element={<SurveysPage />} />
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="notification-templates" element={<NotificationTemplatesPage />} />
        <Route path="app-config" element={<AppConfigPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
