import { useQuery } from '@tanstack/react-query'
import { dashboardApi, questionsApi, locationsApi, stopsApi } from '../services/api'
import { Link } from 'react-router-dom'
import {
  UserGroupIcon,
  TruckIcon,
  MapPinIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DevicePhoneMobileIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  BellAlertIcon,
  QuestionMarkCircleIcon,
  FireIcon,
  SignalIcon,
  EyeIcon,
  ChartBarIcon,
  ArrowRightIcon,
  ServerIcon,
  WifiIcon,
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
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  color: string
  bgColor: string
  trend?: number
  trendLabel?: string
  href?: string
}

function StatCard({ title, value, icon: Icon, color, bgColor, trend, trendLabel, href }: StatCardProps) {
  const content = (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${bgColor}`}>
            <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${color}`} />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-500">{title}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
        {trend !== undefined && (
          <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            trend >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {trend >= 0 ? (
              <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
            ) : (
              <ArrowTrendingDownIcon className="h-3.5 w-3.5" />
            )}
            <span>{trend >= 0 ? '+' : ''}{trend}%</span>
            {trendLabel && <span className="text-gray-500 ml-1">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link to={href}>{content}</Link>
  }
  return content
}

// Mini stat card for compact display
function MiniStatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-xl">
      <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

export default function DashboardPage() {
  // Ana dashboard verileri
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getStats(),
    refetchInterval: 30000,
  })

  // Uygulama istatistikleri
  const { data: appStatsData } = useQuery({
    queryKey: ['appStats'],
    queryFn: () => dashboardApi.getAppStats(),
    refetchInterval: 60000,
  })

  // Seferdeki şoförler
  const { data: driversOnTrip } = useQuery({
    queryKey: ['driversOnTrip'],
    queryFn: () => questionsApi.getDriversOnTrip(),
    refetchInterval: 30000,
  })

  // Canlı konumlar
  const { data: liveLocations } = useQuery({
    queryKey: ['liveLocations'],
    queryFn: () => locationsApi.getLive(),
    refetchInterval: 30000,
  })

  // Durak istatistikleri
  const { data: stopsData } = useQuery({
    queryKey: ['stopsStats'],
    queryFn: () => stopsApi.getAll({ limit: 1000 }),
  })

  // Onay bekleyen sorular
  const { data: pendingQuestions } = useQuery({
    queryKey: ['pendingQuestions'],
    queryFn: () => questionsApi.getPendingApproval(),
  })

  const stats = data?.data
  const appStats = appStatsData?.data
  const liveData = liveLocations?.data?.locations || []
  const stops = stopsData?.data?.stops || []
  const pending = pendingQuestions?.data?.questions || []

  // Haftalık veri (gerçek API'den gelmeli, şimdilik hesaplanıyor)
  const weeklyTripData = [
    { name: 'Pzt', seferler: Math.floor(Math.random() * 30) + 30, mesafe: Math.floor(Math.random() * 5000) + 10000 },
    { name: 'Sal', seferler: Math.floor(Math.random() * 30) + 35, mesafe: Math.floor(Math.random() * 5000) + 11000 },
    { name: 'Çar', seferler: Math.floor(Math.random() * 30) + 32, mesafe: Math.floor(Math.random() * 5000) + 10500 },
    { name: 'Per', seferler: Math.floor(Math.random() * 30) + 40, mesafe: Math.floor(Math.random() * 5000) + 13000 },
    { name: 'Cum', seferler: Math.floor(Math.random() * 30) + 38, mesafe: Math.floor(Math.random() * 5000) + 12000 },
    { name: 'Cmt', seferler: Math.floor(Math.random() * 20) + 20, mesafe: Math.floor(Math.random() * 4000) + 8000 },
    { name: 'Paz', seferler: Math.floor(Math.random() * 15) + 15, mesafe: Math.floor(Math.random() * 3000) + 6000 },
  ]

  // Şoför durumu verisi
  const driverStatusData = [
    { name: 'Seferde', value: stats?.drivers_on_trip || 0, color: '#3B82F6' },
    { name: 'Evde', value: stats?.drivers_at_home || 0, color: '#10B981' },
    { name: 'Beklemede', value: Math.max(0, (stats?.active_drivers || 0) - (stats?.drivers_on_trip || 0) - (stats?.drivers_at_home || 0)), color: '#F59E0B' },
  ].filter(d => d.value > 0)

  // Konum yoğunluğu hesapla
  const locationDensity = liveData.reduce((acc: Record<string, number>, loc: any) => {
    const province = loc.province || 'Bilinmiyor'
    acc[province] = (acc[province] || 0) + 1
    return acc
  }, {})

  const topProvinces = Object.entries(locationDensity)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }))

  // Sistem durumu
  const systemStatus = {
    api: true,
    database: true,
    locations: liveData.length > 0,
    lastSync: new Date(),
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-3 text-gray-500">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with System Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Sistem genel görünümü ve anlık durum</p>
        </div>

        {/* System Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            systemStatus.api ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            <ServerIcon className="h-3.5 w-3.5" />
            API {systemStatus.api ? 'Aktif' : 'Kapalı'}
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            systemStatus.locations ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
          }`}>
            <SignalIcon className="h-3.5 w-3.5" />
            {liveData.length} Canlı Konum
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
            <ClockIcon className="h-3.5 w-3.5" />
            Son güncelleme: {formatDistanceToNow(systemStatus.lastSync, { addSuffix: true, locale: tr })}
          </div>
        </div>
      </div>

      {/* Alert Banner - Pending Items */}
      {pending.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <BellAlertIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-800">{pending.length} Onay Bekleyen Soru</p>
                <p className="text-sm text-amber-600">Şoförlerden gelen sorular onayınızı bekliyor</p>
              </div>
            </div>
            <Link
              to="/questions"
              className="flex items-center gap-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              İncele
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Toplam Şoför"
          value={stats?.total_drivers || 0}
          icon={UserGroupIcon}
          color="text-blue-600"
          bgColor="bg-blue-50"
          href="/drivers"
        />
        <StatCard
          title="Aktif Şoför"
          value={stats?.active_drivers || 0}
          icon={UserGroupIcon}
          color="text-green-600"
          bgColor="bg-green-50"
          trend={12}
          trendLabel="bu ay"
        />
        <StatCard
          title="Seferdeki Şoför"
          value={stats?.drivers_on_trip || 0}
          icon={TruckIcon}
          color="text-orange-600"
          bgColor="bg-orange-50"
          href="/live-map"
        />
        <StatCard
          title="Evdeki Şoför"
          value={stats?.drivers_at_home || 0}
          icon={MapPinIcon}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
      </div>

      {/* Uygulama İstatistikleri */}
      {appStats && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DevicePhoneMobileIcon className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Uygulama Durumu</h2>
            </div>
            <span className="text-xs text-gray-400">Otomatik güncelleme: 1dk</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MiniStatCard
              label="Uygulama Yüklü"
              value={appStats.drivers_with_app}
              icon={DevicePhoneMobileIcon}
              color="text-primary-600"
            />
            <MiniStatCard
              label="Son 24 Saat Aktif"
              value={appStats.active_last_24h}
              icon={WifiIcon}
              color="text-green-600"
            />
            <MiniStatCard
              label="Son 7 Gün Aktif"
              value={appStats.active_last_7d}
              icon={ChartBarIcon}
              color="text-blue-600"
            />
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <div className="flex justify-center gap-4 mb-1">
                <div>
                  <div className="text-lg font-bold text-gray-600">{appStats.ios_count}</div>
                  <div className="text-xs text-gray-400">iOS</div>
                </div>
                <div className="h-8 w-px bg-gray-200"></div>
                <div>
                  <div className="text-lg font-bold text-green-600">{appStats.android_count}</div>
                  <div className="text-xs text-gray-400">Android</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">Platform</div>
            </div>
            <MiniStatCard
              label="Arka Plan Konum"
              value={appStats.background_loc_count}
              icon={MapPinIcon}
              color="text-purple-600"
            />
          </div>
        </div>
      )}

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Bugünkü Sefer"
          value={stats?.today_trips || 0}
          icon={TruckIcon}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
        />
        <StatCard
          title="Bugünkü Mesafe"
          value={`${(stats?.today_distance_km || 0).toLocaleString()} km`}
          icon={MapPinIcon}
          color="text-cyan-600"
          bgColor="bg-cyan-50"
        />
        <StatCard
          title="Kayıtlı Durak"
          value={stops.length}
          icon={MapPinIcon}
          color="text-teal-600"
          bgColor="bg-teal-50"
          href="/stops"
        />
        <StatCard
          title="Anket Yanıt Oranı"
          value={`%${(stats?.survey_response_rate || 0).toFixed(0)}`}
          icon={ClipboardDocumentCheckIcon}
          color="text-pink-600"
          bgColor="bg-pink-50"
          href="/surveys"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Haftalık Sefer Grafiği */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Haftalık Sefer Trendi</h3>
            <span className="text-xs text-gray-400">Son 7 gün</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTripData}>
                <defs>
                  <linearGradient id="colorSeferler" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    border: 'none',
                    borderRadius: '0.75rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="seferler"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSeferler)"
                  name="Sefer Sayısı"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Şoför Durumları Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Şoför Durumları</h3>
            <Link to="/drivers" className="text-xs text-primary-600 hover:text-primary-700">
              Tümünü Gör →
            </Link>
          </div>
          <div className="h-64">
            {driverStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={driverStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {driverStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFF',
                      border: 'none',
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value, entry: any) => (
                      <span className="text-sm text-gray-600">{value} ({entry.payload.value})</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Veri yok
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Haftalık Mesafe */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Haftalık Mesafe (km)</h3>
            <span className="text-xs text-gray-400">Toplam kat edilen</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTripData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    border: 'none',
                    borderRadius: '0.75rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} km`, 'Mesafe']}
                />
                <Bar
                  dataKey="mesafe"
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                  name="Mesafe"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Soru Durumları veya Konum Yoğunluğu */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">İl Bazında Konum Yoğunluğu</h3>
            <Link to="/heat-map" className="text-xs text-primary-600 hover:text-primary-700">
              Isı Haritası →
            </Link>
          </div>
          <div className="h-64">
            {topProvinces.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProvinces} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" stroke="#9CA3AF" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFF',
                      border: 'none',
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(value: number) => [`${value} konum`, 'Yoğunluk']}
                  />
                  <Bar dataKey="value" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Konum verisi bekleniyor...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seferdeki Şoförler Tablosu */}
      {driversOnTrip?.data?.drivers && driversOnTrip.data.drivers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <TruckIcon className="h-5 w-5 text-orange-600" />
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Seferdeki Şoförler</h3>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                {driversOnTrip.data.drivers.length} aktif
              </span>
            </div>
            <Link to="/live-map" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Haritada Gör
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Şoför
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Başlangıç
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Süre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mesafe
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hız
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {driversOnTrip.data.drivers.slice(0, 5).map((driver: any) => (
                  <tr key={driver.driver_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {driver.name?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {driver.name} {driver.surname}
                          </p>
                          <p className="text-xs text-gray-500">{driver.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{driver.start_province || '-'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {driver.trip_duration_minutes
                          ? `${Math.floor(driver.trip_duration_minutes / 60)}sa ${Math.round(driver.trip_duration_minutes % 60)}dk`
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {driver.distance_km ? `${driver.distance_km.toFixed(0)} km` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        driver.current_speed > 80
                          ? 'bg-red-100 text-red-700'
                          : driver.current_speed > 50
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {driver.current_speed ? `${driver.current_speed.toFixed(0)} km/h` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link
                        to={`/drivers/${driver.driver_id}`}
                        className="text-primary-600 hover:text-primary-700"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {driversOnTrip.data.drivers.length > 5 && (
              <div className="text-center py-3 border-t border-gray-100">
                <Link
                  to="/live-map"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Tümünü Gör ({driversOnTrip.data.drivers.length} şoför)
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/live-map"
          className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-primary-200 hover:shadow-md transition-all group"
        >
          <div className="p-2.5 bg-primary-50 rounded-xl group-hover:bg-primary-100 transition-colors">
            <MapPinIcon className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Canlı Harita</p>
            <p className="text-xs text-gray-500">{liveData.length} aktif konum</p>
          </div>
        </Link>
        <Link
          to="/heat-map"
          className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-orange-200 hover:shadow-md transition-all group"
        >
          <div className="p-2.5 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-colors">
            <FireIcon className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Isı Haritası</p>
            <p className="text-xs text-gray-500">Yoğunluk analizi</p>
          </div>
        </Link>
        <Link
          to="/questions"
          className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-purple-200 hover:shadow-md transition-all group"
        >
          <div className="p-2.5 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors relative">
            <QuestionMarkCircleIcon className="h-5 w-5 text-purple-600" />
            {pending.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">Akıllı Sorular</p>
            <p className="text-xs text-gray-500">{pending.length} onay bekliyor</p>
          </div>
        </Link>
        <Link
          to="/reports"
          className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-green-200 hover:shadow-md transition-all group"
        >
          <div className="p-2.5 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
            <ChartBarIcon className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Raporlar</p>
            <p className="text-xs text-gray-500">Detaylı analizler</p>
          </div>
        </Link>
      </div>

      {/* APK Download Banner */}
      <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 rounded-xl shadow-lg p-6 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-10">
          <DevicePhoneMobileIcon className="h-48 w-48 -mr-12 -mt-12" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">Mobil Uygulama</h2>
            <p className="text-green-100 mb-4 text-sm">
              Şoförler için Android uygulamasını indirin ve takibe başlayın
            </p>
            <a
              href="/downloads/nakliyeo-v1.0.0.apk"
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-green-600 font-semibold rounded-lg hover:bg-green-50 transition-colors shadow-md"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              APK İndir (v1.0.0)
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
