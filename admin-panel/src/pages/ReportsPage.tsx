import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi, questionsApi, dashboardApi } from '../services/api'
import {
  ChartBarIcon,
  DocumentChartBarIcon,
  TruckIcon,
  ClockIcon,
  CalendarIcon,
  MapPinIcon,
  QuestionMarkCircleIcon,
  PrinterIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  DocumentTextIcon,
  TableCellsIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import {
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
import toast from 'react-hot-toast'

type ReportType = 'routes' | 'stops' | 'questions' | 'drivers' | 'overview'
type DateRange = '7d' | '30d' | '90d' | 'custom'
type ExportFormat = 'csv' | 'json' | 'print'

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('overview')
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [customDates, setCustomDates] = useState({
    start: '',
    end: '',
  })

  const getDateParams = () => {
    const now = new Date()
    let start_date: string
    let end_date = now.toISOString().split('T')[0]

    switch (dateRange) {
      case '7d':
        start_date = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0]
        break
      case '30d':
        start_date = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0]
        break
      case '90d':
        start_date = new Date(now.setDate(now.getDate() - 90)).toISOString().split('T')[0]
        break
      case 'custom':
        start_date = customDates.start
        end_date = customDates.end
        break
      default:
        start_date = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0]
    }

    return { start_date, end_date }
  }

  // Genel dashboard verileri
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getStats(),
  })

  // Güzergah raporu
  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['reports', 'routes', dateRange, customDates],
    queryFn: () => reportsApi.getRoutes(getDateParams()),
    enabled: selectedReport === 'routes' || selectedReport === 'overview',
  })

  // Durak raporu
  const { data: stopsData, isLoading: stopsLoading } = useQuery({
    queryKey: ['reports', 'stops', dateRange, customDates],
    queryFn: () => reportsApi.getStops(getDateParams()),
    enabled: selectedReport === 'stops' || selectedReport === 'overview',
  })

  // Soru istatistikleri
  const { data: questionStatsData, isLoading: questionStatsLoading } = useQuery({
    queryKey: ['reports', 'questions'],
    queryFn: () => questionsApi.getStats(),
    enabled: selectedReport === 'questions' || selectedReport === 'overview',
  })

  const dashboardStats = dashboardData?.data
  const routes = routesData?.data?.routes || []
  const routesSummary = routesData?.data?.summary || {}
  const stops = stopsData?.data?.stops || []
  const stopsSummary = stopsData?.data?.summary || {}
  const questionStats = questionStatsData?.data?.stats || {}

  const reportTabs = [
    { id: 'overview', label: 'Genel Özet', icon: DocumentChartBarIcon },
    { id: 'routes', label: 'Güzergah Analizi', icon: TruckIcon },
    { id: 'stops', label: 'Durak Analizi', icon: MapPinIcon },
    { id: 'questions', label: 'Soru İstatistikleri', icon: QuestionMarkCircleIcon },
    { id: 'drivers', label: 'Şoför Performansı', icon: UserGroupIcon },
  ]

  const isLoading =
    (selectedReport === 'routes' && routesLoading) ||
    (selectedReport === 'stops' && stopsLoading) ||
    (selectedReport === 'questions' && questionStatsLoading) ||
    (selectedReport === 'overview' && (routesLoading || stopsLoading))

  // Grafik verileri
  const routeChartData = useMemo(() => {
    return routes.slice(0, 10).map((r: any) => ({
      name: `${r.from_province?.substring(0, 3)} → ${r.to_province?.substring(0, 3)}`,
      sefer: r.trip_count,
      mesafe: r.avg_distance_km,
    }))
  }, [routes])

  const stopTypeData = useMemo(() => {
    const typeCount: Record<string, number> = {}
    stops.forEach((s: any) => {
      const type = s.stop_type || 'other'
      typeCount[type] = (typeCount[type] || 0) + s.stop_count
    })
    return Object.entries(typeCount).map(([name, value]) => ({
      name: name === 'rest' ? 'Mola' : name === 'loading' ? 'Yükleme' : name === 'unloading' ? 'Boşaltma' : 'Diğer',
      value,
    }))
  }, [stops])

  const questionStatusData = useMemo(() => {
    return Object.entries(questionStats.by_status || {}).map(([status, count]) => ({
      name: status === 'draft' ? 'Taslak'
        : status === 'pending_approval' ? 'Onay Bekliyor'
        : status === 'approved' ? 'Onaylı'
        : status === 'rejected' ? 'Reddedildi'
        : status === 'sent' ? 'Gönderildi'
        : status === 'answered' ? 'Cevaplandı'
        : status === 'expired' ? 'Süresi Doldu'
        : status,
      value: count as number,
    }))
  }, [questionStats])

  const handleExport = (data: any[], filename: string, format: ExportFormat) => {
    if (format === 'print') {
      window.print()
      return
    }

    if (!data || data.length === 0) {
      toast.error('Export edilecek veri yok')
      return
    }

    let content: string
    let mimeType: string
    let extension: string

    if (format === 'csv') {
      const headers = Object.keys(data[0])
      content = [
        headers.join(','),
        ...data.map(row => headers.map(header => JSON.stringify(row[header] ?? '')).join(',')),
      ].join('\n')
      mimeType = 'text/csv;charset=utf-8;'
      extension = 'csv'
    } else {
      content = JSON.stringify(data, null, 2)
      mimeType = 'application/json'
      extension = 'json'
    }

    const blob = new Blob([content], { type: mimeType })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.${extension}`
    link.click()
    toast.success(`${extension.toUpperCase()} dosyası indirildi`)
  }

  const ExportButtons = ({ data, filename }: { data: any[]; filename: string }) => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleExport(data, filename, 'csv')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <TableCellsIcon className="h-4 w-4" />
        CSV
      </button>
      <button
        onClick={() => handleExport(data, filename, 'json')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <DocumentTextIcon className="h-4 w-4" />
        JSON
      </button>
      <button
        onClick={() => handleExport([], '', 'print')}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        <PrinterIcon className="h-4 w-4" />
        Yazdır
      </button>
    </div>
  )

  const StatCard = ({ title, value, subtitle, icon: Icon, color, bgColor, trend }: {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ElementType
    color: string
    bgColor: string
    trend?: number
  }) => (
    <div className={`${bgColor} rounded-xl p-4`}>
      <div className="flex items-start justify-between">
        <div className={`p-2 ${color.replace('text-', 'bg-').replace('600', '200')} rounded-lg`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
            {Math.abs(trend).toFixed(0)}%
          </div>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className={`text-xs ${color}`}>{title}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )

  return (
    <div className="space-y-5 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>
          <p className="text-sm text-gray-500">Detaylı analiz ve veri exportu</p>
        </div>

        {/* Date Range */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
            <CalendarIcon className="h-4 w-4 text-gray-400 ml-2" />
            {[
              { value: '7d', label: '7 Gün' },
              { value: '30d', label: '30 Gün' },
              { value: '90d', label: '90 Gün' },
              { value: 'custom', label: 'Özel' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value as DateRange)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dateRange === option.value
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDates.start}
                onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={customDates.end}
                onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">TestSistem Rapor</h1>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('tr-TR')}</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-0">
        <div className="border-b border-gray-100 overflow-x-auto print:hidden">
          <nav className="flex min-w-max">
            {reportTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedReport(tab.id as ReportType)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  selectedReport === tab.id
                    ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-3 text-sm text-gray-500">Rapor yükleniyor...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview */}
              {selectedReport === 'overview' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Genel Özet Raporu</h3>
                    <ExportButtons data={[{ ...routesSummary, ...stopsSummary, ...dashboardStats }]} filename="genel_ozet" />
                  </div>

                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                      title="Toplam Şoför"
                      value={dashboardStats?.total_drivers || 0}
                      subtitle="Kayıtlı"
                      icon={UserGroupIcon}
                      color="text-blue-600"
                      bgColor="bg-blue-50"
                    />
                    <StatCard
                      title="Aktif Şoför"
                      value={dashboardStats?.active_drivers || 0}
                      subtitle="Bu dönem"
                      icon={UserGroupIcon}
                      color="text-green-600"
                      bgColor="bg-green-50"
                      trend={12}
                    />
                    <StatCard
                      title="Toplam Sefer"
                      value={routesSummary.total_trips || 0}
                      subtitle="Seçili dönem"
                      icon={TruckIcon}
                      color="text-orange-600"
                      bgColor="bg-orange-50"
                    />
                    <StatCard
                      title="Toplam Mesafe"
                      value={`${((routesSummary.total_distance_km || 0) / 1000).toFixed(0)}K km`}
                      subtitle="Seçili dönem"
                      icon={MapPinIcon}
                      color="text-purple-600"
                      bgColor="bg-purple-50"
                    />
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">En Popüler Güzergahlar</h4>
                      <div className="h-64">
                        {routeChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={routeChartData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="#9CA3AF" width={70} />
                              <Tooltip contentStyle={{ backgroundColor: '#FFF', border: 'none', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                              <Bar dataKey="sefer" fill="#3b82f6" name="Sefer Sayısı" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                            Veri yok
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Durak Türü Dağılımı</h4>
                      <div className="h-64">
                        {stopTypeData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stopTypeData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {stopTypeData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                            Veri yok
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary Table */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Dönem Özeti</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Ort. Sefer Süresi</p>
                        <p className="text-lg font-bold text-gray-900">{(routesSummary.avg_duration_hours || 0).toFixed(1)} sa</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Ort. Mesafe</p>
                        <p className="text-lg font-bold text-gray-900">{(routesSummary.avg_distance_km || 0).toFixed(0)} km</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Toplam Durak</p>
                        <p className="text-lg font-bold text-gray-900">{stopsSummary.total_stops || 0}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Ort. Durak Süresi</p>
                        <p className="text-lg font-bold text-gray-900">{(stopsSummary.avg_duration_minutes || 0).toFixed(0)} dk</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Routes Report */}
              {selectedReport === 'routes' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Güzergah Analizi</h3>
                    <ExportButtons data={routes} filename="guzergah_raporu" />
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Toplam Sefer" value={routesSummary.total_trips || 0} icon={TruckIcon} color="text-blue-600" bgColor="bg-blue-50" />
                    <StatCard title="Toplam Mesafe" value={`${(routesSummary.total_distance_km || 0).toLocaleString()} km`} icon={MapPinIcon} color="text-green-600" bgColor="bg-green-50" />
                    <StatCard title="Ort. Süre" value={`${(routesSummary.avg_duration_hours || 0).toFixed(1)} sa`} icon={ClockIcon} color="text-orange-600" bgColor="bg-orange-50" />
                    <StatCard title="Ort. Mesafe" value={`${(routesSummary.avg_distance_km || 0).toFixed(0)} km`} icon={ChartBarIcon} color="text-purple-600" bgColor="bg-purple-50" />
                  </div>

                  {/* Chart */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Güzergah Bazlı Sefer Sayısı</h4>
                    <div className="h-72">
                      {routeChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={routeChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
                            <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                            <Tooltip contentStyle={{ backgroundColor: '#FFF', border: 'none', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                            <Bar dataKey="sefer" fill="#3b82f6" name="Sefer" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">Veri yok</div>
                      )}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Güzergah</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sefer</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Mesafe</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ort. Mesafe</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ort. Süre</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {routes.map((route: any, index: number) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {route.from_province} <span className="text-gray-400">→</span> {route.to_province}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{route.trip_count}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{route.total_distance_km?.toLocaleString()} km</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{route.avg_distance_km?.toFixed(0)} km</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{route.avg_duration_hours?.toFixed(1)} sa</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {routes.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <TruckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p>Bu tarih aralığında güzergah verisi bulunamadı</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Stops Report */}
              {selectedReport === 'stops' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Durak Analizi</h3>
                    <ExportButtons data={stops} filename="durak_raporu" />
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatCard title="Toplam Durak" value={stopsSummary.total_stops || 0} icon={MapPinIcon} color="text-blue-600" bgColor="bg-blue-50" />
                    <StatCard title="Ort. Süre" value={`${(stopsSummary.avg_duration_minutes || 0).toFixed(0)} dk`} icon={ClockIcon} color="text-orange-600" bgColor="bg-orange-50" />
                    <StatCard title="Toplam Süre" value={`${(stopsSummary.total_duration_hours || 0).toFixed(1)} sa`} icon={DocumentChartBarIcon} color="text-green-600" bgColor="bg-green-50" />
                  </div>

                  {/* Chart */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Durak Türü Dağılımı</h4>
                    <div className="h-64">
                      {stopTypeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={stopTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                              {stopTypeData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend layout="vertical" align="right" verticalAlign="middle" />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">Veri yok</div>
                      )}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Konum</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sayı</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ort. Süre</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Süre</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {stops.map((stop: any, index: number) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{stop.location_name || stop.province}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{stop.stop_count}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{stop.avg_duration_minutes?.toFixed(0)} dk</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{stop.max_duration_minutes?.toFixed(0)} dk</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                stop.stop_type === 'rest' ? 'bg-green-100 text-green-700'
                                : stop.stop_type === 'loading' ? 'bg-blue-100 text-blue-700'
                                : stop.stop_type === 'unloading' ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-600'
                              }`}>
                                {stop.stop_type === 'rest' ? 'Mola'
                                : stop.stop_type === 'loading' ? 'Yükleme'
                                : stop.stop_type === 'unloading' ? 'Boşaltma'
                                : stop.stop_type || 'Diğer'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {stops.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <MapPinIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p>Bu tarih aralığında durak verisi bulunamadı</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Questions Report */}
              {selectedReport === 'questions' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Soru İstatistikleri</h3>
                    <ExportButtons data={[questionStats]} filename="soru_raporu" />
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Onay Bekleyen" value={questionStats.pending_approval || 0} icon={QuestionMarkCircleIcon} color="text-blue-600" bgColor="bg-blue-50" />
                    <StatCard title="Yanıt Oranı" value={`%${(questionStats.answer_rate || 0).toFixed(1)}`} icon={ChartBarIcon} color="text-green-600" bgColor="bg-green-50" />
                    <StatCard title="Toplam Soru" value={questionStats.total || 0} icon={DocumentTextIcon} color="text-purple-600" bgColor="bg-purple-50" />
                    <StatCard title="Cevaplanan" value={questionStats.by_status?.answered || 0} icon={ClockIcon} color="text-orange-600" bgColor="bg-orange-50" />
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Duruma Göre Dağılım</h4>
                      <div className="h-64">
                        {questionStatusData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={questionStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                                {questionStatusData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value) => <span className="text-xs">{value}</span>} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-400">Veri yok</div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Detaylı Durum</h4>
                      <div className="space-y-3">
                        {Object.entries(questionStats.by_status || {}).map(([status, count]) => {
                          const total = Object.values(questionStats.by_status || {}).reduce((a: number, b: any) => a + b, 0) as number
                          const percentage = total > 0 ? ((count as number) / total) * 100 : 0
                          return (
                            <div key={status}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-600">
                                  {status === 'draft' ? 'Taslak'
                                  : status === 'pending_approval' ? 'Onay Bekliyor'
                                  : status === 'approved' ? 'Onaylı'
                                  : status === 'rejected' ? 'Reddedildi'
                                  : status === 'sent' ? 'Gönderildi'
                                  : status === 'answered' ? 'Cevaplandı'
                                  : status === 'expired' ? 'Süresi Doldu'
                                  : status}
                                </span>
                                <span className="text-xs font-medium text-gray-900">{count as number}</span>
                              </div>
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary-500 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Source Distribution */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Kaynağa Göre Dağılım</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(questionStats.by_source || {}).map(([source, count]) => (
                        <div key={source} className="bg-white rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-gray-900">{count as number}</p>
                          <p className="text-xs text-gray-500">
                            {source === 'manual' ? 'Manuel'
                            : source === 'manual_bulk' ? 'Toplu Manuel'
                            : source === 'auto_rule' ? 'Otomatik Kural'
                            : source === 'ai_generated' ? 'AI Üretimi'
                            : source}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Drivers Report (placeholder) */}
              {selectedReport === 'drivers' && (
                <div className="text-center py-16 text-gray-500">
                  <UserGroupIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Şoför Performans Raporu</h3>
                  <p className="text-sm">Bu rapor yakında eklenecek</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
