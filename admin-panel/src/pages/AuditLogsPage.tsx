import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '../services/api'
import {
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'

interface AuditLog {
  id: string
  user_id?: string
  user_type: string
  user_email?: string
  action: string
  resource_type: string
  resource_id?: string
  details?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
}

const actionLabels: Record<string, { label: string; color: string }> = {
  login: { label: 'Giriş', color: 'bg-green-100 text-green-800' },
  logout: { label: 'Çıkış', color: 'bg-gray-100 text-gray-800' },
  create: { label: 'Oluşturma', color: 'bg-blue-100 text-blue-800' },
  update: { label: 'Güncelleme', color: 'bg-yellow-100 text-yellow-800' },
  delete: { label: 'Silme', color: 'bg-red-100 text-red-800' },
  view: { label: 'Görüntüleme', color: 'bg-purple-100 text-purple-800' },
  approve: { label: 'Onaylama', color: 'bg-green-100 text-green-800' },
  reject: { label: 'Reddetme', color: 'bg-red-100 text-red-800' },
  send: { label: 'Gönderme', color: 'bg-blue-100 text-blue-800' },
}

const resourceLabels: Record<string, string> = {
  driver: 'Şoför',
  vehicle: 'Araç',
  trailer: 'Dorse',
  question: 'Soru',
  survey: 'Anket',
  trip: 'Sefer',
  admin: 'Admin',
  settings: 'Ayarlar',
  notification: 'Bildirim',
  general: 'Genel',
}

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    user_type: '',
  })
  const [page, setPage] = useState(0)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: () => auditApi.getAll({
      ...filters,
      limit,
      offset: page * limit,
    }),
  })

  const { data: statsData } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: () => auditApi.getStats(),
  })

  const logs = (data?.data?.logs || []) as AuditLog[]
  const total = data?.data?.total || 0
  const stats = statsData?.data?.stats || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logları</h1>
          <p className="text-gray-600">Sistem işlem kayıtları</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ClockIcon className="h-5 w-5" />
          <span>Son 24 saat: {stats.last_24h || 0} işlem</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(stats.by_action || {}).slice(0, 4).map(([action, count]) => (
          <div key={action} className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500">{actionLabels[action]?.label || action}</div>
            <div className="text-2xl font-bold text-gray-900">{count as number}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium">Filtrele:</span>
          </div>

          <select
            value={filters.action}
            onChange={(e) => { setFilters(f => ({ ...f, action: e.target.value })); setPage(0); }}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tüm İşlemler</option>
            {Object.entries(actionLabels).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filters.resource_type}
            onChange={(e) => { setFilters(f => ({ ...f, resource_type: e.target.value })); setPage(0); }}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tüm Kaynaklar</option>
            {Object.entries(resourceLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filters.user_type}
            onChange={(e) => { setFilters(f => ({ ...f, user_type: e.target.value })); setPage(0); }}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Tüm Kullanıcılar</option>
            <option value="admin">Admin</option>
            <option value="driver">Şoför</option>
          </select>
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
            <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Henüz log kaydı yok</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kullanıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlem</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kaynak</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {log.user_email || 'Bilinmiyor'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {log.user_type === 'admin' ? 'Admin' : 'Şoför'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${actionLabels[log.action]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {actionLabels[log.action]?.label || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {resourceLabels[log.resource_type] || log.resource_type}
                        {log.resource_id && (
                          <span className="text-xs text-gray-400 ml-1">
                            ({log.resource_id.slice(0, 8)}...)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {log.ip_address || '-'}
                      </td>
                    </tr>
                  ))}
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
    </div>
  )
}
