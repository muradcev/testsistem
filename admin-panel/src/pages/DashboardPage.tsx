import { useQuery } from '@tanstack/react-query'
import { dashboardApi, questionsApi, locationsApi, stopsApi } from '../services/api'
import { Link } from 'react-router-dom'
import {
  UserGroupIcon,
  TruckIcon,
  MapPinIcon,
  ClipboardDocumentCheckIcon,
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
  HomeModernIcon,
  PlayCircleIcon,
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
import { StatCard, MiniStatCard } from '../components/ui/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { LoadingOverlay } from '../components/ui/Loading'
import { PageHeader } from '../components/ui/PageHeader'

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

  // Haftalık istatistikler
  const { data: weeklyData } = useQuery({
    queryKey: ['weeklyStats'],
    queryFn: () => dashboardApi.getWeeklyStats(),
    refetchInterval: 60000,
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

  // Haftalık veri (gerçek API'den)
  const weeklyStats = weeklyData?.data?.weekly_stats || []
  const weeklyTripData = weeklyStats.map((stat: { day_name: string; trip_count: number; distance_km: number }) => ({
    name: stat.day_name,
    seferler: stat.trip_count,
    mesafe: Math.round(stat.distance_km),
  }))

  // Şoför durumu verisi
  const driverStatusData = [
    { name: 'Seferde', value: stats?.drivers_on_trip || 0, color: '#3B82F6' },
    { name: 'Evde', value: stats?.drivers_at_home || 0, color: '#10B981' },
    { name: 'Beklemede', value: Math.max(0, (stats?.active_drivers || 0) - (stats?.drivers_on_trip || 0) - (stats?.drivers_at_home || 0)), color: '#F59E0B' },
  ].filter(d => d.value > 0)

  // Konum yoğunluğu hesapla
  const locationDensity = liveData.reduce((acc: Record<string, number>, loc: { province?: string }) => {
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
    return <LoadingOverlay message="Dashboard yükleniyor..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Dashboard"
          subtitle="Sistem genel görünümü ve anlık durum"
        />

        {/* System Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={systemStatus.api ? 'success' : 'error'} dot>
            <ServerIcon className="h-3.5 w-3.5 mr-1" />
            API {systemStatus.api ? 'Aktif' : 'Kapalı'}
          </Badge>
          <Badge variant={systemStatus.locations ? 'success' : 'warning'} dot>
            <SignalIcon className="h-3.5 w-3.5 mr-1" />
            {liveData.length} Canlı Konum
          </Badge>
          <Badge variant="info">
            <ClockIcon className="h-3.5 w-3.5 mr-1" />
            {formatDistanceToNow(systemStatus.lastSync, { addSuffix: true, locale: tr })}
          </Badge>
        </div>
      </div>

      {/* Alert Banner - Pending Items */}
      {pending.length > 0 && (
        <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <BellAlertIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-800">{pending.length} Onay Bekleyen Soru</p>
                <p className="text-sm text-amber-600">Şoförlerden gelen sorular onayınızı bekliyor</p>
              </div>
            </div>
            <Link to="/questions">
              <Button variant="primary" size="sm" icon={ArrowRightIcon} iconPosition="right">
                İncele
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Toplam Şoför"
          value={stats?.total_drivers || 0}
          icon={UserGroupIcon}
          color="blue"
          onClick={() => window.location.href = '/drivers'}
        />
        <StatCard
          title="Aktif Şoför"
          value={stats?.active_drivers || 0}
          icon={UserGroupIcon}
          color="green"
          trend={{ value: 12, label: 'bu ay', isPositive: true }}
        />
        <StatCard
          title="Seferdeki Şoför"
          value={stats?.drivers_on_trip || 0}
          icon={TruckIcon}
          color="orange"
          onClick={() => window.location.href = '/live-map'}
        />
        <StatCard
          title="Evdeki Şoför"
          value={stats?.drivers_at_home || 0}
          icon={HomeModernIcon}
          color="purple"
        />
      </div>

      {/* App Statistics */}
      {appStats && (
        <Card>
          <CardHeader
            action={<span className="text-xs text-gray-400">Otomatik güncelleme: 1dk</span>}
          >
            <CardTitle subtitle="Mobil uygulama kullanım istatistikleri">
              <div className="flex items-center gap-2">
                <DevicePhoneMobileIcon className="h-5 w-5 text-primary-600" />
                Uygulama Durumu
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MiniStatCard
                title="Uygulama Yüklü"
                value={appStats.drivers_with_app}
                icon={DevicePhoneMobileIcon}
                color="purple"
              />
              <MiniStatCard
                title="Son 24 Saat Aktif"
                value={appStats.active_last_24h}
                icon={WifiIcon}
                color="green"
              />
              <MiniStatCard
                title="Son 7 Gün Aktif"
                value={appStats.active_last_7d}
                icon={ChartBarIcon}
                color="blue"
              />
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-center gap-6 mb-2">
                  <div className="text-center">
                    <div className="text-xl font-bold text-gray-600">{appStats.ios_count}</div>
                    <div className="text-xs text-gray-400">iOS</div>
                  </div>
                  <div className="h-10 w-px bg-gray-200" />
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">{appStats.android_count}</div>
                    <div className="text-xs text-gray-400">Android</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">Platform Dağılımı</p>
              </div>
              <MiniStatCard
                title="Arka Plan Konum"
                value={appStats.background_loc_count}
                icon={MapPinIcon}
                color="purple"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStatCard
          title="Bugünkü Sefer"
          value={stats?.today_trips || 0}
          icon={PlayCircleIcon}
          color="blue"
        />
        <MiniStatCard
          title="Bugünkü Mesafe"
          value={`${(stats?.today_distance_km || 0).toLocaleString()} km`}
          icon={MapPinIcon}
          color="green"
        />
        <MiniStatCard
          title="Kayıtlı Durak"
          value={stops.length}
          icon={MapPinIcon}
          color="orange"
          onClick={() => window.location.href = '/stops'}
        />
        <MiniStatCard
          title="Anket Yanıt Oranı"
          value={`%${(stats?.survey_response_rate || 0).toFixed(0)}`}
          icon={ClipboardDocumentCheckIcon}
          color="purple"
          onClick={() => window.location.href = '/surveys'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Haftalık Sefer Grafiği */}
        <Card>
          <CardHeader action={<span className="text-xs text-gray-400">Son 7 gün</span>}>
            <CardTitle>Haftalık Sefer Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {weeklyTripData.length > 0 ? (
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
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Sefer verisi yükleniyor...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Şoför Durumları Pie Chart */}
        <Card>
          <CardHeader
            action={
              <Link to="/drivers" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Tümünü Gör →
              </Link>
            }
          >
            <CardTitle>Şoför Durumları</CardTitle>
          </CardHeader>
          <CardContent>
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
                      formatter={(value, entry: { payload?: { value?: number } }) => (
                        <span className="text-sm text-gray-600">{value} ({entry.payload?.value})</span>
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
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Haftalık Mesafe */}
        <Card>
          <CardHeader action={<span className="text-xs text-gray-400">Toplam kat edilen</span>}>
            <CardTitle>Haftalık Mesafe (km)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {weeklyTripData.length > 0 ? (
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
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Mesafe verisi yükleniyor...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Konum Yoğunluğu */}
        <Card>
          <CardHeader
            action={
              <Link to="/heat-map" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Isı Haritası →
              </Link>
            }
          >
            <CardTitle>İl Bazında Konum Yoğunluğu</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      {/* Seferdeki Şoförler Tablosu */}
      {driversOnTrip?.data?.drivers && driversOnTrip.data.drivers.length > 0 && (
        <Card padding="none">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <TruckIcon className="h-5 w-5 text-orange-600" />
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Seferdeki Şoförler</h3>
                <Badge variant="warning">{driversOnTrip.data.drivers.length} aktif</Badge>
              </div>
              <Link to="/live-map">
                <Button variant="ghost" size="sm" icon={MapPinIcon}>
                  Haritada Gör
                </Button>
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Şoför
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Başlangıç
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Süre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Mesafe
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Hız
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {driversOnTrip.data.drivers.slice(0, 5).map((driver: {
                  driver_id: string
                  name?: string
                  surname?: string
                  phone?: string
                  start_province?: string
                  trip_duration_minutes?: number
                  distance_km?: number
                  current_speed?: number
                }) => (
                  <tr key={driver.driver_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md">
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
                      <Badge
                        variant={
                          (driver.current_speed || 0) > 80
                            ? 'error'
                            : (driver.current_speed || 0) > 50
                            ? 'warning'
                            : 'success'
                        }
                      >
                        {driver.current_speed ? `${driver.current_speed.toFixed(0)} km/h` : '-'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link
                        to={`/drivers/${driver.driver_id}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {driversOnTrip.data.drivers.length > 5 && (
              <div className="text-center py-4 border-t border-gray-100 bg-gray-50">
                <Link
                  to="/live-map"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Tümünü Gör ({driversOnTrip.data.drivers.length} şoför)
                </Link>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/live-map"
          className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl hover:border-primary-200 hover:shadow-lg transition-all duration-200 group"
        >
          <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg shadow-primary-500/25 group-hover:scale-105 transition-transform">
            <MapPinIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Canlı Harita</p>
            <p className="text-xs text-gray-500">{liveData.length} aktif konum</p>
          </div>
        </Link>
        <Link
          to="/heat-map"
          className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl hover:border-orange-200 hover:shadow-lg transition-all duration-200 group"
        >
          <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
            <FireIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Isı Haritası</p>
            <p className="text-xs text-gray-500">Yoğunluk analizi</p>
          </div>
        </Link>
        <Link
          to="/questions"
          className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl hover:border-purple-200 hover:shadow-lg transition-all duration-200 group"
        >
          <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/25 group-hover:scale-105 transition-transform relative">
            <QuestionMarkCircleIcon className="h-5 w-5 text-white" />
            {pending.length > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium shadow-md">
                {pending.length}
              </span>
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900">Akıllı Sorular</p>
            <p className="text-xs text-gray-500">{pending.length} onay bekliyor</p>
          </div>
        </Link>
        <Link
          to="/reports"
          className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl hover:border-green-200 hover:shadow-lg transition-all duration-200 group"
        >
          <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg shadow-green-500/25 group-hover:scale-105 transition-transform">
            <ChartBarIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Raporlar</p>
            <p className="text-xs text-gray-500">Detaylı analizler</p>
          </div>
        </Link>
      </div>

      {/* APK Download Banner */}
      <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 rounded-2xl shadow-xl p-6 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-10">
          <DevicePhoneMobileIcon className="h-48 w-48 -mr-12 -mt-12" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold mb-2">Mobil Uygulama</h2>
            <p className="text-green-100 text-sm">
              Şoförler için Android uygulamasını indirin ve takibe başlayın
            </p>
          </div>
          <a
            href="https://github.com/muradcev/testsistem/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-green-600 font-semibold rounded-xl hover:bg-green-50 transition-all shadow-lg hover:shadow-xl"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            APK İndir (Güncel)
          </a>
        </div>
      </div>
    </div>
  )
}
