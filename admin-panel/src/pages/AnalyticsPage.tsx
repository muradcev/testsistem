import { useState, useMemo } from 'react'
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
  ArrowTrendingDownIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  ClockIcon,
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
  ComposedChart,
} from 'recharts'
import 'leaflet/dist/leaflet.css'
import api from '../services/api'
import toast from 'react-hot-toast'

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

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
  'Hatay': [36.2, 36.16],
  'Manisa': [38.6191, 27.4289],
  'Kocaeli': [40.7654, 29.9408],
  'Sakarya': [40.7569, 30.3781],
  'Tekirdağ': [41.0022, 27.5126],
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

type DateRange = '7d' | '14d' | '30d' | '90d' | 'all'
type TabType = 'overview' | 'charts' | 'map' | 'stats' | 'prices'

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [selectedProvince, setSelectedProvince] = useState<string>('all')

  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['route-heatmap'],
    queryFn: () => api.get('/admin/analytics/heatmap'),
  })

  const { data: provinceData, isLoading: provinceLoading } = useQuery({
    queryKey: ['province-stats'],
    queryFn: () => api.get('/admin/analytics/province-stats'),
  })

  const { data: dailyData, isLoading: dailyLoading, refetch } = useQuery({
    queryKey: ['daily-stats'],
    queryFn: () => api.get('/admin/analytics/daily-stats'),
  })

  const { data: priceMatrix, isLoading: priceLoading } = useQuery({
    queryKey: ['price-matrix'],
    queryFn: () => api.get('/admin/analytics/price-matrix'),
  })

  const heatmap: RouteHeatmapItem[] = heatmapData?.data?.heatmap || []
  const provinceStats: ProvinceStats[] = provinceData?.data?.province_stats || []
  const dailyStats: DailyStat[] = dailyData?.data?.daily_stats || []
  const prices = priceMatrix?.data?.price_matrix || []

  const isLoading = heatmapLoading || provinceLoading || dailyLoading || priceLoading

  // Tarih aralığına göre filtrele
  const filteredDailyStats = useMemo(() => {
    if (dateRange === 'all') return dailyStats
    const days = parseInt(dateRange)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return dailyStats.filter(d => new Date(d.stat_date) >= cutoff)
  }, [dailyStats, dateRange])

  // Özet istatistikler
  const summary = useMemo(() => {
    const totalTrips = filteredDailyStats.reduce((sum, d) => sum + d.total_trips, 0)
    const totalDistance = filteredDailyStats.reduce((sum, d) => sum + d.total_distance_km, 0)
    const totalRevenue = filteredDailyStats.reduce((sum, d) => sum + d.total_revenue, 0)
    const avgPrice = filteredDailyStats.length > 0
      ? filteredDailyStats.reduce((sum, d) => sum + d.avg_price, 0) / filteredDailyStats.length
      : 0
    const avgDrivers = filteredDailyStats.length > 0
      ? filteredDailyStats.reduce((sum, d) => sum + d.active_drivers, 0) / filteredDailyStats.length
      : 0

    // Önceki dönemle karşılaştırma
    const halfLength = Math.floor(filteredDailyStats.length / 2)
    const currentPeriod = filteredDailyStats.slice(0, halfLength)
    const previousPeriod = filteredDailyStats.slice(halfLength)

    const currentTrips = currentPeriod.reduce((sum, d) => sum + d.total_trips, 0)
    const previousTrips = previousPeriod.reduce((sum, d) => sum + d.total_trips, 0)
    const tripsTrend = previousTrips > 0 ? ((currentTrips - previousTrips) / previousTrips) * 100 : 0

    const currentRevenue = currentPeriod.reduce((sum, d) => sum + d.total_revenue, 0)
    const previousRevenue = previousPeriod.reduce((sum, d) => sum + d.total_revenue, 0)
    const revenueTrend = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0

    return {
      totalTrips,
      totalDistance,
      totalRevenue,
      avgPrice,
      avgDrivers,
      tripsTrend,
      revenueTrend,
    }
  }, [filteredDailyStats])

  // Heatmap çizgileri
  const routeLines = useMemo(() => {
    return heatmap
      .filter(r => provinceCoords[r.from_province] && provinceCoords[r.to_province])
      .filter(r => selectedProvince === 'all' || r.from_province === selectedProvince || r.to_province === selectedProvince)
      .map(route => ({
        positions: [
          provinceCoords[route.from_province],
          provinceCoords[route.to_province],
        ] as [[number, number], [number, number]],
        weight: Math.min(route.trip_count / 2, 10) + 1,
        color: route.trip_count > 20 ? '#ef4444' : route.trip_count > 10 ? '#f97316' : '#3b82f6',
        route,
      }))
  }, [heatmap, selectedProvince])

  // İl noktaları
  const provinceMarkers = useMemo(() => {
    return provinceStats
      .filter(p => provinceCoords[p.province])
      .filter(p => selectedProvince === 'all' || p.province === selectedProvince)
      .map(stat => ({
        position: provinceCoords[stat.province],
        radius: Math.min(stat.driver_count * 2, 30) + 5,
        stat,
      }))
  }, [provinceStats, selectedProvince])

  // Chart verileri
  const chartData = useMemo(() => {
    return filteredDailyStats
      .slice()
      .reverse()
      .map(stat => ({
        date: new Date(stat.stat_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
        sefer: stat.total_trips,
        mesafe: Math.round(stat.total_distance_km),
        ciro: Math.round(stat.total_revenue),
        sofor: stat.active_drivers,
        fiyat: Math.round(stat.avg_price),
      }))
  }, [filteredDailyStats])

  // İl bazlı pasta grafik
  const provinceChartData = useMemo(() => {
    return provinceStats.slice(0, 8).map(stat => ({
      name: stat.province,
      value: stat.trip_count,
    }))
  }, [provinceStats])

  // Unique provinces for filter
  const uniqueProvinces = useMemo(() => {
    const provinces = new Set<string>()
    heatmap.forEach(r => {
      provinces.add(r.from_province)
      provinces.add(r.to_province)
    })
    return Array.from(provinces).sort()
  }, [heatmap])

  // Export function
  const handleExport = (type: 'csv' | 'json') => {
    let data: string
    let filename: string
    let mimeType: string

    if (type === 'csv') {
      const headers = ['Tarih', 'Aktif Şoför', 'Toplam Sefer', 'Mesafe (km)', 'Ort. Fiyat', 'Toplam Ciro']
      const rows = filteredDailyStats.map(d => [
        new Date(d.stat_date).toLocaleDateString('tr-TR'),
        d.active_drivers,
        d.total_trips,
        d.total_distance_km.toFixed(0),
        d.avg_price.toFixed(0),
        d.total_revenue.toFixed(0),
      ])
      data = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      filename = `analytics-${dateRange}.csv`
      mimeType = 'text/csv'
    } else {
      data = JSON.stringify({ dailyStats: filteredDailyStats, provinceStats, heatmap }, null, 2)
      filename = `analytics-${dateRange}.json`
      mimeType = 'application/json'
    }

    const blob = new Blob([data], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${type.toUpperCase()} dosyası indirildi`)
  }

  const tabs = [
    { id: 'overview', label: 'Genel Bakış', icon: ChartBarIcon },
    { id: 'charts', label: 'Grafikler', icon: ArrowTrendingUpIcon },
    { id: 'map', label: 'Güzergah Haritası', icon: MapIcon },
    { id: 'stats', label: 'Detaylı İstatistik', icon: GlobeAltIcon },
    { id: 'prices', label: 'Fiyat Matrisi', icon: CurrencyDollarIcon },
  ]

  const dateRangeOptions = [
    { value: '7d', label: 'Son 7 Gün' },
    { value: '14d', label: 'Son 14 Gün' },
    { value: '30d', label: 'Son 30 Gün' },
    { value: '90d', label: 'Son 90 Gün' },
    { value: 'all', label: 'Tüm Zamanlar' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analitik & Raporlar</h1>
          <p className="text-sm text-gray-500">Detaylı performans analizi ve güzergah istatistikleri</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            <CalendarIcon className="h-4 w-4 text-gray-400 ml-2" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="text-sm border-0 bg-transparent focus:ring-0 pr-8"
            >
              {dateRangeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Province Filter */}
          {(activeTab === 'map' || activeTab === 'stats') && (
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
              <FunnelIcon className="h-4 w-4 text-gray-400 ml-2" />
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="text-sm border-0 bg-transparent focus:ring-0 pr-8"
              >
                <option value="all">Tüm İller</option>
                {uniqueProvinces.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Yenile"
          >
            <ArrowPathIcon className="h-4 w-4 text-gray-600" />
          </button>

          {/* Export */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export
            </button>
            <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleExport('csv')}
                className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
              >
                CSV olarak indir
              </button>
              <button
                onClick={() => handleExport('json')}
                className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
              >
                JSON olarak indir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex space-x-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-3 text-sm text-gray-500">Veriler yükleniyor...</p>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {!isLoading && activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <TruckIcon className="h-5 w-5 text-blue-600" />
                </div>
                {summary.tripsTrend !== 0 && (
                  <div className={`flex items-center gap-0.5 text-xs font-medium ${
                    summary.tripsTrend >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {summary.tripsTrend >= 0 ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
                    {Math.abs(summary.tripsTrend).toFixed(0)}%
                  </div>
                )}
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{summary.totalTrips.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Toplam Sefer</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-green-50 rounded-lg">
                  <MapIcon className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">
                {(summary.totalDistance / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-gray-500">Toplam Mesafe (km)</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <CurrencyDollarIcon className="h-5 w-5 text-purple-600" />
                </div>
                {summary.revenueTrend !== 0 && (
                  <div className={`flex items-center gap-0.5 text-xs font-medium ${
                    summary.revenueTrend >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {summary.revenueTrend >= 0 ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
                    {Math.abs(summary.revenueTrend).toFixed(0)}%
                  </div>
                )}
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">
                {(summary.totalRevenue / 1000).toFixed(0)}K ₺
              </p>
              <p className="text-xs text-gray-500">Toplam Ciro</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="p-2 bg-orange-50 rounded-lg w-fit">
                <ChartBarIcon className="h-5 w-5 text-orange-600" />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{summary.avgPrice.toFixed(0)} ₺</p>
              <p className="text-xs text-gray-500">Ortalama Fiyat</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="p-2 bg-cyan-50 rounded-lg w-fit">
                <ClockIcon className="h-5 w-5 text-cyan-600" />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{summary.avgDrivers.toFixed(0)}</p>
              <p className="text-xs text-gray-500">Ort. Aktif Şoför/Gün</p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sefer ve Ciro Combo Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Sefer & Ciro Trendi</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FFF', border: 'none', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="sefer" fill="#3b82f6" name="Sefer" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="ciro" stroke="#22c55e" strokeWidth={2} dot={false} name="Ciro (₺)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* İl Dağılımı */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">İl Bazlı Sefer Dağılımı</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={provinceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {provinceChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Routes Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">En Popüler Güzergahlar</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Güzergah</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sefer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ort. Mesafe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ort. Fiyat</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yoğunluk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {heatmap.slice(0, 10).map((route, idx) => {
                    const maxTrips = Math.max(...heatmap.map(h => h.trip_count))
                    const intensity = (route.trip_count / maxTrips) * 100
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{route.from_province}</span>
                          <span className="text-gray-400 mx-2">→</span>
                          <span className="text-sm text-gray-600">{route.to_province}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{route.trip_count}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{route.avg_distance_km?.toFixed(0)} km</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{route.avg_price?.toFixed(0)} ₺</td>
                        <td className="px-4 py-3">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${intensity}%`,
                                backgroundColor: intensity > 70 ? '#ef4444' : intensity > 40 ? '#f97316' : '#3b82f6'
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Charts Tab */}
      {!isLoading && activeTab === 'charts' && (
        <div className="space-y-6">
          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Günlük Sefer Trendi</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSefer" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#FFF', border: 'none', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="sefer" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSefer)" name="Sefer Sayısı" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Günlük Ciro Trendi</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorCiro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#FFF', border: 'none', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} formatter={(value: number) => `${value.toLocaleString('tr-TR')} ₺`} />
                    <Area type="monotone" dataKey="ciro" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorCiro)" name="Ciro (₺)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Günlük Mesafe (km)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#FFF', border: 'none', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} formatter={(value: number) => `${value.toLocaleString('tr-TR')} km`} />
                    <Bar dataKey="mesafe" fill="#f97316" name="Mesafe (km)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Aktif Şoför Sayısı</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#FFF', border: 'none', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="sofor" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} name="Aktif Şoför" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Ortalama Fiyat Trendi</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#FFF', border: 'none', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} formatter={(value: number) => `${value.toLocaleString('tr-TR')} ₺`} />
                    <Line type="monotone" dataKey="fiyat" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} name="Ort. Fiyat (₺)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {chartData.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <ChartBarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Seçilen tarih aralığında veri bulunamadı</p>
            </div>
          )}
        </div>
      )}

      {/* Map Tab */}
      {!isLoading && activeTab === 'map' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-gray-900">Türkiye Güzergah Haritası</h2>
                <p className="text-xs text-gray-500">Çizgi kalınlığı sefer sayısını, daire büyüklüğü şoför sayısını gösterir</p>
              </div>
              <div className="text-xs text-gray-400">
                {routeLines.length} güzergah, {provinceMarkers.length} il
              </div>
            </div>
            <div className="h-[500px] lg:h-[600px] rounded-lg overflow-hidden">
              <MapContainer center={[39.0, 35.0]} zoom={6} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {routeLines.map((line, idx) => (
                  <Polyline key={idx} positions={line.positions} color={line.color} weight={line.weight} opacity={0.6}>
                    <Popup>
                      <div className="text-sm">
                        <strong>{line.route.from_province} → {line.route.to_province}</strong>
                        <br />Sefer: {line.route.trip_count}
                        <br />Ort. Mesafe: {line.route.avg_distance_km?.toFixed(0)} km
                        <br />Ort. Fiyat: {line.route.avg_price?.toFixed(0)} ₺
                      </div>
                    </Popup>
                  </Polyline>
                ))}
                {provinceMarkers.map((marker, idx) => (
                  <CircleMarker key={idx} center={marker.position} radius={marker.radius} fillColor="#22c55e" color="#16a34a" weight={2} opacity={0.8} fillOpacity={0.5}>
                    <Popup>
                      <div className="text-sm">
                        <strong>{marker.stat.province}</strong>
                        <br />Şoför: {marker.stat.driver_count}
                        <br />Sefer: {marker.stat.trip_count}
                        <br />Mesafe: {marker.stat.total_distance_km?.toFixed(0)} km
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-medium text-sm mb-3">Harita Açıklamaları</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-blue-500 rounded"></div>
                <span className="text-gray-600">1-10 Sefer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-orange-500 rounded"></div>
                <span className="text-gray-600">11-20 Sefer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-red-500 rounded"></div>
                <span className="text-gray-600">20+ Sefer</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500 opacity-60"></div>
                <span className="text-gray-600">İl (şoför sayısına göre boyut)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {!isLoading && activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Province Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">İl Bazlı İstatistikler</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İl</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Şoför</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sefer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mesafe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ort. Fiyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {provinceStats
                    .filter(s => selectedProvince === 'all' || s.province === selectedProvince)
                    .slice(0, 25)
                    .map((stat, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.province}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.driver_count}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.trip_count}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.total_distance_km?.toFixed(0)} km</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.avg_price?.toFixed(0)} ₺</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Günlük İstatistikler</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Şoför</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sefer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mesafe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ort. Fiyat</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ciro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredDailyStats.slice(0, 30).map((stat, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {new Date(stat.stat_date).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{stat.active_drivers}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{stat.total_trips}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{stat.total_distance_km?.toFixed(0)} km</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{stat.avg_price?.toFixed(0)} ₺</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">{stat.total_revenue?.toFixed(0)} ₺</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Prices Tab */}
      {!isLoading && activeTab === 'prices' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Şehirlerarası Fiyat Matrisi</h3>
            <p className="text-xs text-gray-500">Güzergah bazlı ortalama fiyatlar ve güvenilirlik seviyeleri</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nereden</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nereye</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sefer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mesafe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ort. Fiyat</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">₺/Km</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Güven</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prices.map((price: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{price.from_province}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{price.to_province}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{price.trip_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{price.avg_distance_km?.toFixed(0)} km</td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600">{price.avg_price?.toFixed(0)} ₺</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{price.price_per_km_avg?.toFixed(2)} ₺</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        price.confidence_level === 'high_confidence'
                          ? 'bg-green-100 text-green-700'
                          : price.confidence_level === 'medium_confidence'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {price.confidence_level === 'high_confidence' ? 'Yüksek'
                          : price.confidence_level === 'medium_confidence' ? 'Orta' : 'Düşük'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {prices.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <CurrencyDollarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p>Henüz yeterli fiyat verisi yok</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
