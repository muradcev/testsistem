import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DriversPage from './pages/DriversPage'
import DriverDetailPage from './pages/DriverDetailPage'
import DriverRoutesPage from './pages/DriverRoutesPage'
import DriverRoutePage from './pages/DriverRoutePage'
import DriverLocationsPage from './pages/DriverLocationsPage'
import LiveMapPage from './pages/LiveMapPage'
import LiveTrackingPage from './pages/LiveTrackingPage'
import HeatMapPage from './pages/HeatMapPage'
import SurveysPage from './pages/SurveysPage'
import SettingsPage from './pages/SettingsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AppConfigPage from './pages/AppConfigPage'
import QuestionsPage from './pages/QuestionsPage'
import QuestionDesignerPage from './pages/QuestionDesignerPage'
import NotificationTemplatesPage from './pages/NotificationTemplatesPage'
import ReportsPage from './pages/ReportsPage'
import ErrorMonitoringPage from './pages/ErrorMonitoringPage'
import StopsPage from './pages/StopsPage'
import MapViewPage from './pages/MapViewPage'
import AuditLogsPage from './pages/AuditLogsPage'
import CallLogsPage from './pages/CallLogsPage'
import ContactsPage from './pages/ContactsPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import TransportRecordsPage from './pages/TransportRecordsPage'
import DistanceCalculatorPage from './pages/DistanceCalculatorPage'
import GeofencesPage from './pages/GeofencesPage'
import AppLogsPage from './pages/AppLogsPage'
import LocationTrackingPage from './pages/LocationTrackingPage'

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
        <Route path="drivers/:id/route" element={<DriverRoutePage />} />
        <Route path="driver-locations" element={<DriverLocationsPage />} />
        <Route path="live-map" element={<LiveMapPage />} />
        <Route path="live-tracking" element={<LiveTrackingPage />} />
        <Route path="heat-map" element={<HeatMapPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="error-monitoring" element={<ErrorMonitoringPage />} />
        <Route path="stops" element={<StopsPage />} />
        <Route path="map-view" element={<MapViewPage />} />
        <Route path="surveys" element={<SurveysPage />} />
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="question-designer" element={<QuestionDesignerPage />} />
        <Route path="notification-templates" element={<NotificationTemplatesPage />} />
        <Route path="app-config" element={<AppConfigPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="call-logs" element={<CallLogsPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="transport-records" element={<TransportRecordsPage />} />
        <Route path="distance-calculator" element={<DistanceCalculatorPage />} />
        <Route path="geofences" element={<GeofencesPage />} />
        <Route path="app-logs" element={<AppLogsPage />} />
        <Route path="location-tracking" element={<LocationTrackingPage />} />
      </Route>
    </Routes>
  )
}
