import { useQuery } from '@tanstack/react-query'
import { dashboardApi, questionsApi } from '../services/api'
import {
  UserGroupIcon,
  TruckIcon,
  MapPinIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DevicePhoneMobileIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  color: string
  trend?: number
  trendLabel?: string
}

function StatCard({ title, value, icon: Icon, color, trend, trendLabel }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`p-2 sm:p-3 rounded-lg ${color}`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="ml-3 sm:ml-4">
            <p className="text-xs sm:text-sm font-medium text-gray-500">{title}</p>
            <p className="text-xl sm:text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        </div>
        {trend !== undefined && (
          <div className={`hidden sm:flex items-center ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? (
              <ArrowTrendingUpIcon className="h-4 w-4" />
            ) : (
              <ArrowTrendingDownIcon className="h-4 w-4" />
            )}
            <span className="text-sm ml-1">
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
            {trendLabel && (
              <span className="text-xs text-gray-400 ml-1">{trendLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getStats(),
    refetchInterval: 30000,
  })

  const { data: questionStats } = useQuery({
    queryKey: ['questionStats'],
    queryFn: () => questionsApi.getStats(),
  })

  const { data: driversOnTrip } = useQuery({
    queryKey: ['driversOnTrip'],
    queryFn: () => questionsApi.getDriversOnTrip(),
  })

  const { data: appStatsData } = useQuery({
    queryKey: ['appStats'],
    queryFn: () => dashboardApi.getAppStats(),
    refetchInterval: 60000,
  })

  const stats = data?.data
  const appStats = appStatsData?.data

  // Örnek haftalık sefer verisi (gerçek API'den gelmeli)
  const weeklyTripData = [
    { name: 'Pzt', seferler: 45, mesafe: 12500 },
    { name: 'Sal', seferler: 52, mesafe: 14200 },
    { name: 'Çar', seferler: 48, mesafe: 13100 },
    { name: 'Per', seferler: 61, mesafe: 16800 },
    { name: 'Cum', seferler: 55, mesafe: 15400 },
    { name: 'Cmt', seferler: 38, mesafe: 10200 },
    { name: 'Paz', seferler: 28, mesafe: 7500 },
  ]

  // Soru durumu verisi
  const questionStatusData = Object.entries(questionStats?.data?.stats?.by_status || {}).map(
    ([status, count]) => ({
      name:
        status === 'draft'
          ? 'Taslak'
          : status === 'pending_approval'
          ? 'Onay Bekliyor'
          : status === 'approved'
          ? 'Onaylı'
          : status === 'rejected'
          ? 'Reddedildi'
          : status === 'sent'
          ? 'Gönderildi'
          : status === 'answered'
          ? 'Cevaplandı'
          : status === 'expired'
          ? 'Süresi Doldu'
          : status,
      value: count as number,
    })
  )

  // Şoför durumu verisi
  const driverStatusData = [
    { name: 'Seferde', value: stats?.drivers_on_trip || 0 },
    { name: 'Evde', value: stats?.drivers_at_home || 0 },
    { name: 'Beklemede', value: (stats?.active_drivers || 0) - (stats?.drivers_on_trip || 0) - (stats?.drivers_at_home || 0) },
  ].filter(d => d.value > 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard
          title="Toplam Şoför"
          value={stats?.total_drivers || 0}
          icon={UserGroupIcon}
          color="bg-blue-500"
        />
        <StatCard
          title="Aktif Şoför"
          value={stats?.active_drivers || 0}
          icon={UserGroupIcon}
          color="bg-green-500"
          trend={12}
          trendLabel="bu ay"
        />
        <StatCard
          title="Seferdeki Şoför"
          value={stats?.drivers_on_trip || 0}
          icon={TruckIcon}
          color="bg-orange-500"
        />
        <StatCard
          title="Evdeki Şoför"
          value={stats?.drivers_at_home || 0}
          icon={MapPinIcon}
          color="bg-purple-500"
        />
      </div>

      {/* Uygulama İstatistikleri */}
      {appStats && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <DevicePhoneMobileIcon className="h-6 w-6 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Uygulama Durumu</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-primary-600">{appStats.drivers_with_app}</div>
              <div className="text-xs text-gray-500">Uygulama Yüklü</div>
              <div className="text-xs text-gray-400">/ {appStats.total_drivers} şoför</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{appStats.active_last_24h}</div>
              <div className="text-xs text-gray-500">Son 24 Saat Aktif</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{appStats.active_last_7d}</div>
              <div className="text-xs text-gray-500">Son 7 Gün Aktif</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-center space-x-4">
                <div>
                  <div className="text-lg font-bold text-gray-700">{appStats.ios_count}</div>
                  <div className="text-xs text-gray-500">iOS</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">{appStats.android_count}</div>
                  <div className="text-xs text-gray-500">Android</div>
                </div>
              </div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{appStats.background_loc_count}</div>
              <div className="text-xs text-gray-500">Arka Plan Konum</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard
          title="Bugünkü Sefer"
          value={stats?.today_trips || 0}
          icon={TruckIcon}
          color="bg-indigo-500"
        />
        <StatCard
          title="Bugünkü Mesafe"
          value={`${(stats?.today_distance_km || 0).toLocaleString()} km`}
          icon={MapPinIcon}
          color="bg-cyan-500"
        />
        <StatCard
          title="Toplam Araç"
          value={stats?.total_vehicles || 0}
          icon={TruckIcon}
          color="bg-teal-500"
        />
        <StatCard
          title="Anket Yanıt Oranı"
          value={`%${(stats?.survey_response_rate || 0).toFixed(0)}`}
          icon={ClipboardDocumentCheckIcon}
          color="bg-pink-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Haftalık Sefer Grafiği */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Haftalık Sefer Sayısı</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTripData}>
                <defs>
                  <linearGradient id="colorSeferler" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '0.5rem',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="seferler"
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#colorSeferler)"
                  name="Sefer Sayısı"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Haftalık Mesafe Grafiği */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Haftalık Toplam Mesafe (km)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTripData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '0.5rem',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} km`, 'Mesafe']}
                />
                <Bar dataKey="mesafe" fill="#10B981" radius={[4, 4, 0, 0]} name="Mesafe" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pie Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Şoför Durumu */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Şoför Durumları</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={driverStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {driverStatusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Soru Durumları */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Soru Durumları</h3>
          <div className="h-64">
            {questionStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={questionStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {questionStatusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Henüz soru verisi yok
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seferdeki Şoförler Tablosu */}
      {driversOnTrip?.data?.drivers && driversOnTrip.data.drivers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Seferdeki Şoförler
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({driversOnTrip.data.drivers.length} şoför)
            </span>
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Şoför
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Başlangıç
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Süre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Mesafe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hız
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {driversOnTrip.data.drivers.slice(0, 5).map((driver: any) => (
                  <tr key={driver.driver_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-700 text-sm font-medium">
                            {driver.name?.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {driver.name} {driver.surname}
                          </p>
                          <p className="text-xs text-gray-500">{driver.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {driver.start_province || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {driver.trip_duration_minutes
                        ? `${Math.floor(driver.trip_duration_minutes / 60)}sa ${Math.round(
                            driver.trip_duration_minutes % 60
                          )}dk`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {driver.distance_km ? `${driver.distance_km.toFixed(0)} km` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {driver.current_speed ? `${driver.current_speed.toFixed(0)} km/h` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {driversOnTrip.data.drivers.length > 5 && (
              <div className="text-center py-3">
                <a
                  href="/live-map"
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  Tümünü Gör ({driversOnTrip.data.drivers.length} şoför)
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* APK Download */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">Mobil Uygulama</h2>
            <p className="text-green-100 mb-4">
              Şoförler için Android uygulamasını indirin
            </p>
            <a
              href="/downloads/nakliyeo-v2.apk"
              download
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-green-600 font-semibold rounded-lg hover:bg-green-50 transition-colors"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              APK İndir
            </a>
          </div>
          <div className="hidden md:block">
            <DevicePhoneMobileIcon className="h-24 w-24 text-green-200" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Hızlı İşlemler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/live-map"
            className="flex items-center justify-center gap-2 p-4 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"
          >
            <MapPinIcon className="h-5 w-5" />
            <span>Canlı Harita</span>
          </a>
          <a
            href="/drivers"
            className="flex items-center justify-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
          >
            <UserGroupIcon className="h-5 w-5" />
            <span>Şoförler</span>
          </a>
          <a
            href="/questions"
            className="flex items-center justify-center gap-2 p-4 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100"
          >
            <ClipboardDocumentCheckIcon className="h-5 w-5" />
            <span>Akıllı Sorular</span>
          </a>
          <a
            href="/reports"
            className="flex items-center justify-center gap-2 p-4 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
          >
            <TruckIcon className="h-5 w-5" />
            <span>Raporlar</span>
          </a>
        </div>
      </div>
    </div>
  )
}
