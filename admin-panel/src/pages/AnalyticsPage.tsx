import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
} from 'react-leaflet'
import {
  ChartBarIcon,
  MapIcon,
  CurrencyDollarIcon,
  TruckIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import 'leaflet/dist/leaflet.css'
import api from '../services/api'

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

// Türkiye il koordinatları
const provinceCoords: Record<string, [number, number]> = {
  'İstanbul': [41.0082, 28.9784],
  'Ankara': [39.9334, 32.8597],
  'İzmir': [38.4237, 27.1428],
  'Bursa': [40.1826, 29.0665],
  'Antalya': [36.8969, 30.7133],
  'Adana': [37.0, 35.3213],
  'Konya': [37.8746, 32.4932],
  'Gaziantep': [37.0662, 37.3833],
  'Mersin': [36.8121, 34.6415],
  'Kayseri': [38.7312, 35.4787],
  'Eskişehir': [39.7767, 30.5206],
  'Samsun': [41.2867, 36.33],
  'Denizli': [37.7765, 29.0864],
  'Şanlıurfa': [37.1591, 38.7969],
  'Trabzon': [41.0027, 39.7168],
  'Diyarbakır': [37.9144, 40.2306],
  'Malatya': [38.3552, 38.3095],
  'Erzurum': [39.9, 41.27],
  'Van': [38.4891, 43.4089],
  'Batman': [37.8812, 41.1351],
  // Daha fazla il eklenebilir
}

interface RouteHeatmapItem {
  from_province: string
  to_province: string
  trip_count: number
  avg_distance_km: number
  avg_price: number
}

interface ProvinceStats {
  province: string
  driver_count: number
  trip_count: number
  total_distance_km: number
  avg_price: number
}

interface DailyStat {
  stat_date: string
  active_drivers: number
  total_trips: number
  completed_trips: number
  total_distance_km: number
  avg_price: number
  total_revenue: number
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'charts' | 'map' | 'stats' | 'prices'>('charts')

  const { data: heatmapData } = useQuery({
    queryKey: ['route-heatmap'],
    queryFn: () => api.get('/admin/analytics/heatmap'),
  })

  const { data: provinceData } = useQuery({
    queryKey: ['province-stats'],
    queryFn: () => api.get('/admin/analytics/province-stats'),
  })

  const { data: dailyData } = useQuery({
    queryKey: ['daily-stats'],
    queryFn: () => api.get('/admin/analytics/daily-stats'),
  })

  const { data: priceMatrix } = useQuery({
    queryKey: ['price-matrix'],
    queryFn: () => api.get('/admin/analytics/price-matrix'),
  })

  const heatmap: RouteHeatmapItem[] = heatmapData?.data?.heatmap || []
  const provinceStats: ProvinceStats[] = provinceData?.data?.province_stats || []
  const dailyStats: DailyStat[] = dailyData?.data?.daily_stats || []
  const prices = priceMatrix?.data?.price_matrix || []

  // Heatmap çizgileri
  const routeLines = heatmap
    .filter(
      (r) => provinceCoords[r.from_province] && provinceCoords[r.to_province]
    )
    .map((route) => ({
      positions: [
        provinceCoords[route.from_province],
        provinceCoords[route.to_province],
      ] as [[number, number], [number, number]],
      weight: Math.min(route.trip_count / 2, 10) + 1,
      color: route.trip_count > 20 ? '#ef4444' : route.trip_count > 10 ? '#f97316' : '#3b82f6',
      route,
    }))

  // İl noktaları
  const provinceMarkers = provinceStats
    .filter((p) => provinceCoords[p.province])
    .map((stat) => ({
      position: provinceCoords[stat.province],
      radius: Math.min(stat.driver_count * 2, 30) + 5,
      stat,
    }))

  const tabs = [
    { id: 'charts', label: 'Grafikler', icon: ArrowTrendingUpIcon },
    { id: 'map', label: 'Güzergah Haritası', icon: MapIcon },
    { id: 'stats', label: 'İstatistikler', icon: ChartBarIcon },
    { id: 'prices', label: 'Fiyat Matrisi', icon: CurrencyDollarIcon },
  ]

  // Grafik verileri için günlük istatistikleri dönüştür
  const chartData = dailyStats
    .slice()
    .reverse()
    .map((stat) => ({
      date: new Date(stat.stat_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
      sefer: stat.total_trips,
      mesafe: Math.round(stat.total_distance_km),
      ciro: Math.round(stat.total_revenue),
      sofor: stat.active_drivers,
      fiyat: Math.round(stat.avg_price),
    }))

  // İl bazlı pasta grafik verisi
  const provinceChartData = provinceStats
    .slice(0, 7)
    .map((stat) => ({
      name: stat.province,
      value: stat.trip_count,
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analitik & Güzergahlar</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Charts Tab */}
      {activeTab === 'charts' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TruckIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Toplam Sefer</p>
                  <p className="text-xl font-semibold">
                    {dailyStats.reduce((sum, d) => sum + d.total_trips, 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MapIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Toplam Mesafe</p>
                  <p className="text-xl font-semibold">
                    {(dailyStats.reduce((sum, d) => sum + d.total_distance_km, 0) / 1000).toFixed(0)}K km
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <CurrencyDollarIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ort. Fiyat</p>
                  <p className="text-xl font-semibold">
                    {(dailyStats.reduce((sum, d) => sum + d.avg_price, 0) / (dailyStats.length || 1)).toFixed(0)} TL
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Toplam Ciro</p>
                  <p className="text-xl font-semibold">
                    {(dailyStats.reduce((sum, d) => sum + d.total_revenue, 0) / 1000).toFixed(0)}K TL
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sefer Trendi */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Gunluk Sefer Trendi</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="sefer"
                      stroke="#3b82f6"
                      fill="#93c5fd"
                      name="Sefer Sayisi"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ciro Trendi */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Gunluk Ciro Trendi</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value: number) => `${value.toLocaleString('tr-TR')} TL`} />
                    <Area
                      type="monotone"
                      dataKey="ciro"
                      stroke="#22c55e"
                      fill="#86efac"
                      name="Ciro (TL)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mesafe Grafiği */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Gunluk Mesafe (km)</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip formatter={(value: number) => `${value.toLocaleString('tr-TR')} km`} />
                    <Bar dataKey="mesafe" fill="#f97316" name="Mesafe (km)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Aktif Şoför Grafiği */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Aktif Sofor Sayisi</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="sofor"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6' }}
                      name="Aktif Sofor"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* İl Bazlı Dağılım */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Il Bazli Sefer Dagilimi</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={provinceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {provinceChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Fiyat Trendi */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">Ortalama Fiyat Trendi</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value: number) => `${value.toLocaleString('tr-TR')} TL`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="fiyat"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: '#ef4444' }}
                    name="Ort. Fiyat (TL)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {chartData.length === 0 && (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
              Grafik verileri yukleniyor veya veri bulunmuyor...
            </div>
          )}
        </div>
      )}

      {/* Map Tab */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Türkiye Güzergah Haritası</h2>
            <p className="text-sm text-gray-500 mb-4">
              Çizgi kalınlığı sefer sayısını, daire büyüklüğü şoför sayısını gösterir.
            </p>
            <div className="h-[600px] rounded-lg overflow-hidden">
              <MapContainer
                center={[39.0, 35.0]}
                zoom={6}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Güzergah çizgileri */}
                {routeLines.map((line, idx) => (
                  <Polyline
                    key={idx}
                    positions={line.positions}
                    color={line.color}
                    weight={line.weight}
                    opacity={0.6}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>{line.route.from_province} → {line.route.to_province}</strong>
                        <br />
                        Sefer Sayısı: {line.route.trip_count}
                        <br />
                        Ort. Mesafe: {line.route.avg_distance_km?.toFixed(0)} km
                        <br />
                        Ort. Fiyat: {line.route.avg_price?.toFixed(0)} ₺
                      </div>
                    </Popup>
                  </Polyline>
                ))}

                {/* İl noktaları */}
                {provinceMarkers.map((marker, idx) => (
                  <CircleMarker
                    key={idx}
                    center={marker.position}
                    radius={marker.radius}
                    fillColor="#22c55e"
                    color="#16a34a"
                    weight={2}
                    opacity={0.8}
                    fillOpacity={0.5}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>{marker.stat.province}</strong>
                        <br />
                        Şoför: {marker.stat.driver_count}
                        <br />
                        Sefer: {marker.stat.trip_count}
                        <br />
                        Toplam Mesafe: {marker.stat.total_distance_km?.toFixed(0)} km
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-3">Harita Açıklamaları</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-blue-500 rounded"></div>
                <span>1-10 Sefer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-orange-500 rounded"></div>
                <span>11-20 Sefer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-red-500 rounded"></div>
                <span>20+ Sefer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500 opacity-60"></div>
                <span>İl (büyüklük = şoför sayısı)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TruckIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Toplam Sefer</p>
                  <p className="text-xl font-semibold">
                    {dailyStats.reduce((sum, d) => sum + d.total_trips, 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MapIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Toplam Mesafe</p>
                  <p className="text-xl font-semibold">
                    {(dailyStats.reduce((sum, d) => sum + d.total_distance_km, 0) / 1000).toFixed(0)}K km
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <CurrencyDollarIcon className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ort. Fiyat</p>
                  <p className="text-xl font-semibold">
                    {(dailyStats.reduce((sum, d) => sum + d.avg_price, 0) / (dailyStats.length || 1)).toFixed(0)} ₺
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Toplam Ciro</p>
                  <p className="text-xl font-semibold">
                    {(dailyStats.reduce((sum, d) => sum + d.total_revenue, 0) / 1000).toFixed(0)}K ₺
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Province Stats Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">İl Bazlı İstatistikler</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    İl
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Şoför
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sefer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Mesafe (km)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ort. Fiyat
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {provinceStats.slice(0, 20).map((stat, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">{stat.province}</td>
                    <td className="px-6 py-4 text-sm">{stat.driver_count}</td>
                    <td className="px-6 py-4 text-sm">{stat.trip_count}</td>
                    <td className="px-6 py-4 text-sm">{stat.total_distance_km?.toFixed(0)}</td>
                    <td className="px-6 py-4 text-sm">{stat.avg_price?.toFixed(0)} ₺</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Daily Stats Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Günlük İstatistikler</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tarih
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Aktif Şoför
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sefer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Mesafe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ort. Fiyat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ciro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dailyStats.slice(0, 30).map((stat, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">
                      {new Date(stat.stat_date).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-6 py-4 text-sm">{stat.active_drivers}</td>
                    <td className="px-6 py-4 text-sm">{stat.total_trips}</td>
                    <td className="px-6 py-4 text-sm">{stat.total_distance_km?.toFixed(0)} km</td>
                    <td className="px-6 py-4 text-sm">{stat.avg_price?.toFixed(0)} ₺</td>
                    <td className="px-6 py-4 text-sm">{stat.total_revenue?.toFixed(0)} ₺</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prices Tab */}
      {activeTab === 'prices' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Şehirlerarası Fiyat Matrisi</h3>
              <p className="text-sm text-gray-500">
                Güzergah bazlı ortalama fiyatlar ve güvenilirlik seviyeleri
              </p>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nereden
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nereye
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sefer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Mesafe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ort. Fiyat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    TL/Km
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Güvenilirlik
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {prices.map((price: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">{price.from_province}</td>
                    <td className="px-6 py-4 text-sm">{price.to_province}</td>
                    <td className="px-6 py-4 text-sm">{price.trip_count}</td>
                    <td className="px-6 py-4 text-sm">{price.avg_distance_km?.toFixed(0)} km</td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                      {price.avg_price?.toFixed(0)} ₺
                    </td>
                    <td className="px-6 py-4 text-sm">{price.price_per_km_avg?.toFixed(2)} ₺</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          price.confidence_level === 'high_confidence'
                            ? 'bg-green-100 text-green-800'
                            : price.confidence_level === 'medium_confidence'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {price.confidence_level === 'high_confidence'
                          ? 'Yüksek'
                          : price.confidence_level === 'medium_confidence'
                          ? 'Orta'
                          : 'Düşük'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {prices.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Henüz yeterli fiyat verisi yok
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
