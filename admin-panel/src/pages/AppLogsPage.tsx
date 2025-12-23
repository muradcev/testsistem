import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { appLogsApi } from '../services/api'
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  BugAntIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  DevicePhoneMobileIcon,
  ServerIcon,
  TrashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface AppLog {
  id: string
  driver_id?: string
  level: string
  category: string
  message: string
  stack_trace?: string
  metadata?: Record<string, unknown>
  screen?: string
  action?: string
  device_id?: string
  device_model?: string
  os_version?: string
  app_version?: string
  build_number?: string
  client_time: string
  server_time: string
  created_at: string
}

interface LogStats {
  total_logs: number
  error_count: number
  critical_count: number
  by_level: Record<string, number>
  by_category: Record<string, number>
  by_device: Record<string, number>
  last_24_hours: number
  last_7_days: number
}

const levelConfig: Record<string, { label: string; color: string; icon: typeof ExclamationCircleIcon }> = {
  debug: { label: 'Debug', color: 'bg-gray-100 text-gray-800', icon: BugAntIcon },
  info: { label: 'Info', color: 'bg-blue-100 text-blue-800', icon: InformationCircleIcon },
  warning: { label: 'Warning', color: 'bg-yellow-100 text-yellow-800', icon: ExclamationTriangleIcon },
  error: { label: 'Error', color: 'bg-red-100 text-red-800', icon: ExclamationCircleIcon },
  critical: { label: 'Critical', color: 'bg-red-600 text-white', icon: ExclamationCircleIcon },
}

const categoryLabels: Record<string, string> = {
  auth: 'Kimlik Doğrulama',
  location: 'Konum',
  network: 'Ağ',
  ui: 'Arayüz',
  background: 'Arka Plan',
  notification: 'Bildirim',
  trip: 'Sefer',
  system: 'Sistem',
  performance: 'Performans',
  api: 'API',
  database: 'Veritabanı',
  other: 'Diğer',
}

export default function AppLogsPage() {
  const [filters, setFilters] = useState({
    level: '',
    category: '',
    search: '',
  })
  const [page, setPage] = useState(0)
  const [selectedLog, setSelectedLog] = useState<AppLog | null>(null)
  const limit = 50

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['app-logs', filters, page],
    queryFn: () => appLogsApi.getAll({
      ...filters,
      limit,
      offset: page * limit,
    }),
    refetchInterval: 30000, // 30 saniyede bir yenile
  })

  const { data: statsData } = useQuery({
    queryKey: ['app-logs-stats'],
    queryFn: () => appLogsApi.getStats(),
    refetchInterval: 60000,
  })

  const logs = (data?.data?.logs || []) as AppLog[]
  const total = data?.data?.total || 0
  const stats = (statsData?.data || {}) as LogStats

  const handleCleanup = async () => {
    if (confirm('30 günden eski logları silmek istediğinize emin misiniz?')) {
      try {
        await appLogsApi.cleanup(30)
        refetch()
        alert('Eski loglar silindi')
      } catch {
        alert('Silme işlemi başarısız')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Uygulama Logları</h1>
          <p className="text-gray-600">Mobil uygulama ve backend hata takibi</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Yenile
          </button>
          <button
            onClick={handleCleanup}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <TrashIcon className="h-4 w-4" />
            Temizle
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <InformationCircleIcon className="h-5 w-5" />
            <span>Son 24 Saat</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.last_24_hours || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
            <span>Hata</span>
          </div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.error_count || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <span>Kritik</span>
          </div>
          <div className="text-2xl font-bold text-red-700 mt-1">{stats.critical_count || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <ServerIcon className="h-5 w-5" />
            <span>Toplam</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total_logs || 0}</div>
        </div>
      </div>

      {/* Category & Level Stats */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Level Distribution */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-medium text-gray-900 mb-3">Seviye Dağılımı</h3>
          <div className="space-y-2">
            {Object.entries(stats.by_level || {}).map(([level, count]) => {
              const config = levelConfig[level] || levelConfig.info
              return (
                <div key={level} className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-medium text-gray-900 mb-3">Kategori Dağılımı</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {Object.entries(stats.by_category || {}).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{categoryLabels[cat] || cat}</span>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium">Filtrele:</span>
          </div>

          <select
            value={filters.level}
            onChange={(e) => { setFilters(f => ({ ...f, level: e.target.value })); setPage(0); }}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tüm Seviyeler</option>
            {Object.entries(levelConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filters.category}
            onChange={(e) => { setFilters(f => ({ ...f, category: e.target.value })); setPage(0); }}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tüm Kategoriler</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Mesaj ara..."
              value={filters.search}
              onChange={(e) => { setFilters(f => ({ ...f, search: e.target.value })); setPage(0); }}
              className="w-full border rounded-lg pl-9 pr-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BugAntIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Henüz log kaydı yok</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seviye</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mesaj</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kaynak</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => {
                    const config = levelConfig[log.level] || levelConfig.info
                    const Icon = config.icon
                    const isBackend = log.device_id === 'backend'

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${config.color}`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {categoryLabels[log.category] || log.category}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">
                          {log.message}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            {isBackend ? (
                              <>
                                <ServerIcon className="h-4 w-4" />
                                <span>Backend</span>
                              </>
                            ) : (
                              <>
                                <DevicePhoneMobileIcon className="h-4 w-4" />
                                <span>{log.device_model || 'Mobil'}</span>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 flex items-center justify-between border-t">
              <div className="text-sm text-gray-500">
                Toplam {total} kayıt
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Önceki
                </button>
                <span className="px-3 py-1 text-sm">
                  Sayfa {page + 1} / {Math.ceil(total / limit) || 1}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * limit >= total}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">Log Detayı</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Level & Category */}
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs rounded-full ${levelConfig[selectedLog.level]?.color || 'bg-gray-100'}`}>
                  {levelConfig[selectedLog.level]?.label || selectedLog.level}
                </span>
                <span className="text-sm text-gray-600">
                  {categoryLabels[selectedLog.category] || selectedLog.category}
                </span>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs text-gray-500 uppercase">Mesaj</label>
                <p className="text-gray-900 mt-1">{selectedLog.message}</p>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Client Zamanı</label>
                  <p className="text-sm text-gray-900">{new Date(selectedLog.client_time).toLocaleString('tr-TR')}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Server Zamanı</label>
                  <p className="text-sm text-gray-900">{new Date(selectedLog.server_time).toLocaleString('tr-TR')}</p>
                </div>
              </div>

              {/* Device Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Cihaz</label>
                  <p className="text-sm text-gray-900">{selectedLog.device_model || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">OS</label>
                  <p className="text-sm text-gray-900">{selectedLog.os_version || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">App Version</label>
                  <p className="text-sm text-gray-900">{selectedLog.app_version || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Build</label>
                  <p className="text-sm text-gray-900">{selectedLog.build_number || '-'}</p>
                </div>
              </div>

              {/* Screen & Action */}
              {(selectedLog.screen || selectedLog.action) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedLog.screen && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Ekran</label>
                      <p className="text-sm text-gray-900">{selectedLog.screen}</p>
                    </div>
                  )}
                  {selectedLog.action && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Aksiyon</label>
                      <p className="text-sm text-gray-900">{selectedLog.action}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Stack Trace */}
              {selectedLog.stack_trace && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">Stack Trace</label>
                  <pre className="mt-1 p-3 bg-gray-900 text-gray-100 text-xs rounded overflow-x-auto">
                    {selectedLog.stack_trace}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">Metadata</label>
                  <pre className="mt-1 p-3 bg-gray-100 text-gray-800 text-xs rounded overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
