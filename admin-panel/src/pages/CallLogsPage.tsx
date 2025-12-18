import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { callLogsApi, driversApi, notificationsApi } from '../services/api'
import {
  PhoneIcon,
  PhoneArrowUpRightIcon,
  PhoneArrowDownLeftIcon,
  PhoneXMarkIcon,
  ClockIcon,
  UserIcon,
  ArrowPathIcon,
  SignalIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import toast from 'react-hot-toast'

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

interface Driver {
  id: string
  name: string
  surname: string
  phone: string
  has_fcm_token: boolean
  call_log_enabled: boolean
  app_version: string | null
  last_active_at: string | null
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
  const [syncingDrivers, setSyncingDrivers] = useState<Set<string>>(new Set())
  const [showDrivers, setShowDrivers] = useState(true)
  const limit = 50

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['all-call-logs', page, callType],
    queryFn: () => callLogsApi.getAll({ limit, offset: page * limit, call_type: callType || undefined }),
  })

  const { data: driversData } = useQuery({
    queryKey: ['drivers-for-sync'],
    queryFn: () => driversApi.getAll({ limit: 100 }),
  })

  const callLogs: CallLog[] = data?.data?.call_logs || []
  const total = data?.data?.total || 0
  const stats: CallLogStats | null = data?.data?.stats || null
  const totalPages = Math.ceil(total / limit)
  const drivers: Driver[] = driversData?.data?.drivers || []

  // FCM token olan ve call_log_enabled şoförler
  const syncableDrivers = drivers.filter(d => d.has_fcm_token && d.call_log_enabled)
  const unsyncableDrivers = drivers.filter(d => !d.has_fcm_token || !d.call_log_enabled)

  const syncMutation = useMutation({
    mutationFn: (driverId: string) => notificationsApi.requestCallLogSync(driverId),
    onMutate: (driverId) => {
      setSyncingDrivers(prev => new Set(prev).add(driverId))
    },
    onSuccess: (_, driverId) => {
      toast.success('Sync istegi gonderildi')
      setSyncingDrivers(prev => {
        const next = new Set(prev)
        next.delete(driverId)
        return next
      })
      // 5 saniye sonra listeyi yenile
      setTimeout(() => refetch(), 5000)
    },
    onError: (_, driverId) => {
      toast.error('Sync istegi gonderilemedi')
      setSyncingDrivers(prev => {
        const next = new Set(prev)
        next.delete(driverId)
        return next
      })
    },
  })

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        syncableDrivers.map(d => notificationsApi.requestCallLogSync(d.id))
      )
      return results
    },
    onMutate: () => {
      syncableDrivers.forEach(d => {
        setSyncingDrivers(prev => new Set(prev).add(d.id))
      })
    },
    onSuccess: (results) => {
      const success = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      toast.success(`${success} sofore sync istegi gonderildi${failed > 0 ? `, ${failed} basarisiz` : ''}`)
      setSyncingDrivers(new Set())
      setTimeout(() => refetch(), 5000)
    },
    onError: () => {
      toast.error('Toplu sync basarisiz')
      setSyncingDrivers(new Set())
    },
  })

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Arama Gecmisi</h1>
          <p className="text-gray-500">Tum soforlerin arama gecmisi</p>
        </div>
        <button
          onClick={() => setShowDrivers(!showDrivers)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
        >
          {showDrivers ? 'Soforleri Gizle' : 'Soforleri Goster'}
        </button>
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

      {/* Drivers Section */}
      {showDrivers && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Soforler ({syncableDrivers.length} aktif / {drivers.length} toplam)
            </h2>
            <button
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending || syncableDrivers.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={clsx('h-4 w-4', syncAllMutation.isPending && 'animate-spin')} />
              Tumunu Senkronize Et
            </button>
          </div>

          {/* Syncable Drivers */}
          {syncableDrivers.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                <CheckCircleIcon className="h-4 w-4" />
                Senkronize Edilebilir ({syncableDrivers.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {syncableDrivers.map(driver => (
                  <div key={driver.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <Link to={`/drivers/${driver.id}`} className="flex items-center gap-2 hover:text-primary-600">
                      <div className="h-8 w-8 rounded-full bg-green-200 flex items-center justify-center">
                        <UserIcon className="h-4 w-4 text-green-700" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{driver.name} {driver.surname}</div>
                        <div className="text-xs text-gray-500">{driver.phone}</div>
                      </div>
                    </Link>
                    <button
                      onClick={() => syncMutation.mutate(driver.id)}
                      disabled={syncingDrivers.has(driver.id)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg disabled:opacity-50"
                      title="Arama gecmisini senkronize et"
                    >
                      <ArrowPathIcon className={clsx('h-5 w-5', syncingDrivers.has(driver.id) && 'animate-spin')} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unsyncable Drivers */}
          {unsyncableDrivers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                <XCircleIcon className="h-4 w-4" />
                Senkronize Edilemez ({unsyncableDrivers.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {unsyncableDrivers.map(driver => (
                  <div key={driver.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-60">
                    <Link to={`/drivers/${driver.id}`} className="flex items-center gap-2 hover:text-primary-600">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <UserIcon className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700">{driver.name} {driver.surname}</div>
                        <div className="text-xs text-gray-400">
                          {!driver.has_fcm_token ? 'FCM yok' : !driver.call_log_enabled ? 'Devre disi' : driver.phone}
                        </div>
                      </div>
                    </Link>
                    <SignalIcon className="h-5 w-5 text-gray-300" />
                  </div>
                ))}
              </div>
            </div>
          )}
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
