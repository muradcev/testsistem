import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { callLogsApi } from '../services/api'
import {
  PhoneIcon,
  PhoneArrowUpRightIcon,
  PhoneArrowDownLeftIcon,
  PhoneXMarkIcon,
  ClockIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface CallLog {
  id: string
  driver_id: string
  driver_name: string
  driver_phone: string
  phone_number: string
  contact_name: string | null
  call_type: string
  duration_seconds: number
  call_timestamp: string
  synced_at: string
}

interface CallLogStats {
  total_calls: number
  outgoing_calls: number
  incoming_calls: number
  missed_calls: number
  total_duration_seconds: number
  total_drivers: number
  unique_contacts: number
}

const callTypeLabels: Record<string, string> = {
  incoming: 'Gelen',
  outgoing: 'Giden',
  missed: 'Cevapsiz',
  rejected: 'Reddedilen',
}

const callTypeIcons: Record<string, typeof PhoneIcon> = {
  incoming: PhoneArrowDownLeftIcon,
  outgoing: PhoneArrowUpRightIcon,
  missed: PhoneXMarkIcon,
  rejected: PhoneXMarkIcon,
}

const callTypeColors: Record<string, string> = {
  incoming: 'text-green-600 bg-green-100',
  outgoing: 'text-blue-600 bg-blue-100',
  missed: 'text-red-600 bg-red-100',
  rejected: 'text-orange-600 bg-orange-100',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sn`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}dk ${secs}sn`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hours}s ${remainMins}dk`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CallLogsPage() {
  const [page, setPage] = useState(0)
  const [callType, setCallType] = useState('')
  const limit = 50

  const { data, isLoading } = useQuery({
    queryKey: ['all-call-logs', page, callType],
    queryFn: () => callLogsApi.getAll({ limit, offset: page * limit, call_type: callType || undefined }),
  })

  const callLogs: CallLog[] = data?.data?.call_logs || []
  const total = data?.data?.total || 0
  const stats: CallLogStats | null = data?.data?.stats || null
  const totalPages = Math.ceil(total / limit)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Arama Gecmisi</h1>
        <p className="text-gray-500">Tum soforlerin arama gecmisi</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Toplam Arama</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_calls}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Giden</div>
            <div className="text-2xl font-bold text-blue-600">{stats.outgoing_calls}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Gelen</div>
            <div className="text-2xl font-bold text-green-600">{stats.incoming_calls}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Cevapsiz</div>
            <div className="text-2xl font-bold text-red-600">{stats.missed_calls}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Toplam Sure</div>
            <div className="text-2xl font-bold text-purple-600">{formatDuration(stats.total_duration_seconds)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Sofor Sayisi</div>
            <div className="text-2xl font-bold text-orange-600">{stats.total_drivers}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Benzersiz Kisi</div>
            <div className="text-2xl font-bold text-indigo-600">{stats.unique_contacts}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCallType('')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              callType === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            Tumu
          </button>
          <button
            onClick={() => setCallType('outgoing')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
              callType === 'outgoing' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <PhoneArrowUpRightIcon className="h-4 w-4" />
            Giden
          </button>
          <button
            onClick={() => setCallType('incoming')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
              callType === 'incoming' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <PhoneArrowDownLeftIcon className="h-4 w-4" />
            Gelen
          </button>
          <button
            onClick={() => setCallType('missed')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
              callType === 'missed' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            <PhoneXMarkIcon className="h-4 w-4" />
            Cevapsiz
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sofor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aranan/Arayan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sure</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {callLogs.map((log) => {
                const Icon = callTypeIcons[log.call_type] || PhoneIcon
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/drivers/${log.driver_id}`} className="flex items-center hover:text-primary-600">
                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="h-4 w-4 text-primary-600" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{log.driver_name}</div>
                          <div className="text-xs text-gray-500">{log.driver_phone}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{log.contact_name || 'Bilinmiyor'}</div>
                      <div className="text-xs text-gray-500">{log.phone_number}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', callTypeColors[log.call_type])}>
                        <Icon className="h-3 w-3" />
                        {callTypeLabels[log.call_type] || log.call_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <ClockIcon className="h-4 w-4" />
                        {formatDuration(log.duration_seconds)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(log.call_timestamp)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {callLogs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <PhoneIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Arama kaydi bulunamadi</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t">
            <div className="text-sm text-gray-500">Toplam {total} arama</div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Onceki
              </button>
              <span className="px-3 py-1 text-sm">
                Sayfa {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * limit >= total}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
