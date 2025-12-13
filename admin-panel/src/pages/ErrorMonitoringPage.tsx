import { useState, useEffect } from 'react'
import {
  ExclamationTriangleIcon,
  BugAntIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  DevicePhoneMobileIcon,
  ServerIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface ErrorStats {
  total_errors: number
  errors_today: number
  errors_this_week: number
  top_errors: TopError[]
  error_trend: ErrorTrend[]
}

interface TopError {
  message: string
  count: number
  last_seen: string
  platform: string
}

interface ErrorTrend {
  date: string
  count: number
}

export default function ErrorMonitoringPage() {
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'mobile' | 'backend'>('overview')

  // Sentry ve Crashlytics dashboard URL'leri
  const sentryDashboardUrl = 'https://sentry.io'
  const crashlyticsDashboardUrl = 'https://console.firebase.google.com'

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    // Simulated data - replace with actual API call when backend endpoint is ready
    setTimeout(() => {
      setStats({
        total_errors: 0,
        errors_today: 0,
        errors_this_week: 0,
        top_errors: [],
        error_trend: [],
      })
      setLoading(false)
    }, 500)
  }

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    subtitle,
  }: {
    title: string
    value: string | number
    icon: React.ComponentType<{ className?: string }>
    color: string
    subtitle?: string
  }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('600', '100')}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hata Takip</h1>
          <p className="text-gray-500 mt-1">
            Uygulama hatalarını ve crash raporlarını izleyin
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadStats}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Yenile
          </button>
        </div>
      </div>

      {/* External Dashboard Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href={sentryDashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl text-white hover:from-purple-600 hover:to-purple-700 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <BugAntIcon className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Sentry Dashboard</h3>
              <p className="text-purple-100 text-sm">Detaylı hata analizi ve performans izleme</p>
            </div>
          </div>
          <ArrowTopRightOnSquareIcon className="h-6 w-6" />
        </a>

        <a
          href={crashlyticsDashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white hover:from-orange-600 hover:to-red-600 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <ExclamationTriangleIcon className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Firebase Crashlytics</h3>
              <p className="text-orange-100 text-sm">Mobil uygulama crash raporları</p>
            </div>
          </div>
          <ArrowTopRightOnSquareIcon className="h-6 w-6" />
        </a>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Toplam Hata"
          value={stats?.total_errors ?? 0}
          icon={BugAntIcon}
          color="text-red-600"
          subtitle="Tüm zamanlar"
        />
        <StatCard
          title="Bugünkü Hatalar"
          value={stats?.errors_today ?? 0}
          icon={ClockIcon}
          color="text-orange-600"
          subtitle="Son 24 saat"
        />
        <StatCard
          title="Bu Haftaki Hatalar"
          value={stats?.errors_this_week ?? 0}
          icon={ChartBarIcon}
          color="text-yellow-600"
          subtitle="Son 7 gün"
        />
      </div>

      {/* Platform Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b">
          <nav className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5" />
                Genel Bakış
              </div>
            </button>
            <button
              onClick={() => setActiveTab('mobile')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'mobile'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <DevicePhoneMobileIcon className="h-5 w-5" />
                Mobil Hatalar
              </div>
            </button>
            <button
              onClick={() => setActiveTab('backend')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'backend'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <ServerIcon className="h-5 w-5" />
                Backend Hatalar
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Info Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <BugAntIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Hata Takip Sistemi Aktif</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Mobil uygulama ve backend hataları otomatik olarak Sentry ve Firebase Crashlytics'e raporlanmaktadır.
                      Detaylı hata analizi için yukarıdaki dashboard linklerini kullanabilirsiniz.
                    </p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <DevicePhoneMobileIcon className="h-5 w-5 text-primary-600" />
                    Mobil Uygulama
                  </h4>
                  <ul className="mt-3 space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Flutter crash raporları
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Ekran geçiş takibi
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Kullanıcı oturum bilgileri
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Network hata izleme
                    </li>
                  </ul>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <ServerIcon className="h-5 w-5 text-primary-600" />
                    Backend Server
                  </h4>
                  <ul className="mt-3 space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Go panic recovery
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      HTTP request tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      Database error logging
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      User context capture
                    </li>
                  </ul>
                </div>
              </div>

              {/* Setup Instructions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Kurulum Bilgileri</h4>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-medium flex-shrink-0">1</span>
                    <div>
                      <p className="font-medium text-gray-700">Sentry DSN</p>
                      <p className="text-gray-500">
                        <code className="bg-gray-200 px-1 py-0.5 rounded">SENTRY_DSN</code> environment variable'ını ayarlayın
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-medium flex-shrink-0">2</span>
                    <div>
                      <p className="font-medium text-gray-700">Firebase Crashlytics</p>
                      <p className="text-gray-500">
                        Firebase Console'dan Crashlytics'i etkinleştirin
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-medium flex-shrink-0">3</span>
                    <div>
                      <p className="font-medium text-gray-700">Mobil Uygulama</p>
                      <p className="text-gray-500">
                        <code className="bg-gray-200 px-1 py-0.5 rounded">lib/config/constants.dart</code> dosyasında Sentry DSN'i güncelleyin
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'mobile' ? (
            <div className="text-center py-12">
              <DevicePhoneMobileIcon className="h-16 w-16 text-gray-300 mx-auto" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Mobil Hata Listesi</h3>
              <p className="mt-2 text-gray-500">
                Mobil uygulama hatalarını görmek için Sentry veya Firebase Crashlytics dashboard'unu kullanın.
              </p>
              <div className="mt-6 flex justify-center gap-4">
                <a
                  href={sentryDashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <BugAntIcon className="h-5 w-5" />
                  Sentry'ye Git
                </a>
                <a
                  href={crashlyticsDashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  <ExclamationTriangleIcon className="h-5 w-5" />
                  Crashlytics'e Git
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <ServerIcon className="h-16 w-16 text-gray-300 mx-auto" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Backend Hata Listesi</h3>
              <p className="mt-2 text-gray-500">
                Backend hatalarını görmek için Sentry dashboard'unu kullanın.
              </p>
              <div className="mt-6">
                <a
                  href={sentryDashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <BugAntIcon className="h-5 w-5" />
                  Sentry'ye Git
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
