import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi, questionsApi } from '../services/api'
import {
  ChartBarIcon,
  DocumentChartBarIcon,
  TruckIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  MapPinIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline'

type ReportType = 'routes' | 'stops' | 'questions' | 'drivers'
type DateRange = '7d' | '30d' | '90d' | 'custom'

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('routes')
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
        start_date = new Date(now.setDate(now.getDate() - 7))
          .toISOString()
          .split('T')[0]
        break
      case '30d':
        start_date = new Date(now.setDate(now.getDate() - 30))
          .toISOString()
          .split('T')[0]
        break
      case '90d':
        start_date = new Date(now.setDate(now.getDate() - 90))
          .toISOString()
          .split('T')[0]
        break
      case 'custom':
        start_date = customDates.start
        end_date = customDates.end
        break
      default:
        start_date = new Date(now.setDate(now.getDate() - 30))
          .toISOString()
          .split('T')[0]
    }

    return { start_date, end_date }
  }

  // Güzergah raporu
  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['reports', 'routes', dateRange, customDates],
    queryFn: () => reportsApi.getRoutes(getDateParams()),
    enabled: selectedReport === 'routes',
  })

  // Durak raporu
  const { data: stopsData, isLoading: stopsLoading } = useQuery({
    queryKey: ['reports', 'stops', dateRange, customDates],
    queryFn: () => reportsApi.getStops(getDateParams()),
    enabled: selectedReport === 'stops',
  })

  // Soru istatistikleri
  const { data: questionStatsData, isLoading: questionStatsLoading } = useQuery({
    queryKey: ['reports', 'questions'],
    queryFn: () => questionsApi.getStats(),
    enabled: selectedReport === 'questions',
  })

  const reportTabs = [
    { id: 'routes', label: 'Güzergah Analizi', icon: TruckIcon },
    { id: 'stops', label: 'Durak Analizi', icon: MapPinIcon },
    { id: 'questions', label: 'Soru İstatistikleri', icon: QuestionMarkCircleIcon },
  ]

  const isLoading =
    (selectedReport === 'routes' && routesLoading) ||
    (selectedReport === 'stops' && stopsLoading) ||
    (selectedReport === 'questions' && questionStatsLoading)

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>
      </div>

      {/* Rapor Tipleri */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {reportTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedReport(tab.id as ReportType)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 ${
                  selectedReport === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tarih Filtresi */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                Tarih Aralığı:
              </span>
            </div>
            <div className="flex gap-2">
              {[
                { value: '7d', label: 'Son 7 Gün' },
                { value: '30d', label: 'Son 30 Gün' },
                { value: '90d', label: 'Son 90 Gün' },
                { value: 'custom', label: 'Özel' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDateRange(option.value as DateRange)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    dateRange === option.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
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
                  onChange={(e) =>
                    setCustomDates((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="date"
                  value={customDates.end}
                  onChange={(e) =>
                    setCustomDates((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            )}
          </div>
        </div>

        {/* Rapor İçeriği */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              {/* Güzergah Raporu */}
              {selectedReport === 'routes' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Güzergah Analizi</h3>
                    <button
                      onClick={() =>
                        exportToCSV(routesData?.data?.routes || [], 'guzergah_raporu')
                      }
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      CSV İndir
                    </button>
                  </div>

                  {/* Özet Kartlar */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <TruckIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-blue-600">Toplam Sefer</p>
                          <p className="text-2xl font-bold text-blue-900">
                            {routesData?.data?.summary?.total_trips || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <MapPinIcon className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-green-600">Toplam Mesafe</p>
                          <p className="text-2xl font-bold text-green-900">
                            {(routesData?.data?.summary?.total_distance_km || 0).toLocaleString()} km
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <ClockIcon className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm text-orange-600">Ortalama Süre</p>
                          <p className="text-2xl font-bold text-orange-900">
                            {(routesData?.data?.summary?.avg_duration_hours || 0).toFixed(1)} sa
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <ChartBarIcon className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-purple-600">Ort. Mesafe</p>
                          <p className="text-2xl font-bold text-purple-900">
                            {(routesData?.data?.summary?.avg_distance_km || 0).toFixed(0)} km
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Güzergah Tablosu */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Güzergah
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Sefer Sayısı
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Toplam Mesafe
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Ort. Mesafe
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Ort. Süre
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(routesData?.data?.routes || []).map(
                          (route: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {route.from_province} → {route.to_province}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {route.trip_count}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {route.total_distance_km?.toLocaleString()} km
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {route.avg_distance_km?.toFixed(0)} km
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {route.avg_duration_hours?.toFixed(1)} sa
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                    {(routesData?.data?.routes || []).length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        Bu tarih aralığında güzergah verisi bulunamadı
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Durak Raporu */}
              {selectedReport === 'stops' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Durak Analizi</h3>
                    <button
                      onClick={() =>
                        exportToCSV(stopsData?.data?.stops || [], 'durak_raporu')
                      }
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      CSV İndir
                    </button>
                  </div>

                  {/* Özet Kartlar */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <MapPinIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-blue-600">Toplam Durak</p>
                          <p className="text-2xl font-bold text-blue-900">
                            {stopsData?.data?.summary?.total_stops || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <ClockIcon className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm text-orange-600">Ort. Durak Süresi</p>
                          <p className="text-2xl font-bold text-orange-900">
                            {(stopsData?.data?.summary?.avg_duration_minutes || 0).toFixed(0)} dk
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <DocumentChartBarIcon className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-green-600">Toplam Süre</p>
                          <p className="text-2xl font-bold text-green-900">
                            {(stopsData?.data?.summary?.total_duration_hours || 0).toFixed(1)} sa
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Durak Tablosu */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Konum
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Durak Sayısı
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Ort. Süre
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            En Uzun
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Tip
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(stopsData?.data?.stops || []).map(
                          (stop: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {stop.location_name || `${stop.province}, ${stop.district}`}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {stop.stop_count}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {stop.avg_duration_minutes?.toFixed(0)} dk
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {stop.max_duration_minutes?.toFixed(0)} dk
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    stop.stop_type === 'rest'
                                      ? 'bg-green-100 text-green-800'
                                      : stop.stop_type === 'loading'
                                      ? 'bg-blue-100 text-blue-800'
                                      : stop.stop_type === 'unloading'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {stop.stop_type === 'rest'
                                    ? 'Mola'
                                    : stop.stop_type === 'loading'
                                    ? 'Yükleme'
                                    : stop.stop_type === 'unloading'
                                    ? 'Boşaltma'
                                    : stop.stop_type || 'Diğer'}
                                </span>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                    {(stopsData?.data?.stops || []).length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        Bu tarih aralığında durak verisi bulunamadı
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Soru İstatistikleri */}
              {selectedReport === 'questions' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Soru İstatistikleri</h3>

                  {/* Özet Kartlar */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <QuestionMarkCircleIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-blue-600">Onay Bekleyen</p>
                          <p className="text-2xl font-bold text-blue-900">
                            {questionStatsData?.data?.stats?.pending_approval || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <ChartBarIcon className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-green-600">Yanıt Oranı</p>
                          <p className="text-2xl font-bold text-green-900">
                            %{(questionStatsData?.data?.stats?.answer_rate || 0).toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Duruma Göre Dağılım */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-4">
                        Duruma Göre Dağılım
                      </h4>
                      <div className="space-y-3">
                        {Object.entries(
                          questionStatsData?.data?.stats?.by_status || {}
                        ).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                              {status === 'draft'
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
                                : status}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {count as number}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-4">
                        Kaynağa Göre Dağılım
                      </h4>
                      <div className="space-y-3">
                        {Object.entries(
                          questionStatsData?.data?.stats?.by_source || {}
                        ).map(([source, count]) => (
                          <div key={source} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                              {source === 'manual'
                                ? 'Manuel'
                                : source === 'manual_bulk'
                                ? 'Toplu Manuel'
                                : source === 'auto_rule'
                                ? 'Otomatik Kural'
                                : source === 'ai_generated'
                                ? 'AI Üretimi'
                                : source}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {count as number}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
