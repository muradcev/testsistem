import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { driversApi, notificationsApi } from '../services/api'
import {
  MapPinIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  MapIcon,
  SignalIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface DriverWithLocation {
  id: string
  name: string
  surname: string
  phone: string
  province: string
  district: string
  is_active: boolean
  status: string
  current_status: string
  last_latitude: number | null
  last_longitude: number | null
  last_location_at: string | null
  last_active_at: string | null
  app_version: string | null
  device_os: string | null
  has_app: boolean
}

const statusLabels: Record<string, string> = {
  active: 'Aktif',
  inactive: 'Pasif',
  passive: 'Pasif',
  on_trip: 'Seferde',
  at_home: 'Evde',
  no_data: 'Veri Yok',
  stale_trip: 'Eski Veri',
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  passive: 'bg-gray-100 text-gray-800',
  on_trip: 'bg-orange-100 text-orange-800',
  at_home: 'bg-blue-100 text-blue-800',
  no_data: 'bg-red-100 text-red-800',
  stale_trip: 'bg-yellow-100 text-yellow-800',
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Hiç'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Az önce'
  if (diffMins < 60) return `${diffMins} dk önce`
  if (diffHours < 24) return `${diffHours} saat önce`
  if (diffDays < 7) return `${diffDays} gün önce`

  return date.toLocaleDateString('tr-TR')
}

function getLocationAge(dateString: string | null): 'fresh' | 'stale' | 'old' | 'none' {
  if (!dateString) return 'none'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 15) return 'fresh'
  if (diffMins < 60) return 'stale'
  return 'old'
}

const locationAgeColors = {
  fresh: 'text-green-600',
  stale: 'text-yellow-600',
  old: 'text-red-600',
  none: 'text-gray-400',
}

export default function DriverLocationsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'with_location' | 'no_location'>('all')
  const [page, setPage] = useState(0)
  const [requestingLocation, setRequestingLocation] = useState<string | null>(null)
  const limit = 50
  const queryClient = useQueryClient()

  // Location request mutation
  const locationRequestMutation = useMutation({
    mutationFn: (driverId: string) => notificationsApi.requestLocation(driverId),
    onSuccess: (_, driverId) => {
      setRequestingLocation(driverId)
      // Auto-refresh after 5 seconds to show new location
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['driver-locations'] })
        setRequestingLocation(null)
      }, 5000)
    },
    onError: () => {
      setRequestingLocation(null)
      alert('Konum isteği gönderilemedi')
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['driver-locations', page, limit],
    queryFn: () => driversApi.getAll({ limit, offset: page * limit }),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const drivers: DriverWithLocation[] = data?.data?.drivers || []
  const total = data?.data?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Filter and search
  const filteredDrivers = drivers.filter((driver) => {
    // Search filter (ad, soyad, telefon, araç plakası, dorse plakası)
    const searchLower = search.toLowerCase()
    const searchMatch =
      driver.name.toLowerCase().includes(searchLower) ||
      driver.surname.toLowerCase().includes(searchLower) ||
      driver.phone.includes(search) ||
      driver.vehicles?.some((v: { plate: string }) => v.plate?.toLowerCase().includes(searchLower)) ||
      driver.trailers?.some((t: { plate: string }) => t.plate?.toLowerCase().includes(searchLower))

    if (!searchMatch) return false

    // Location filter
    if (filter === 'with_location' && !driver.last_latitude) return false
    if (filter === 'no_location' && driver.last_latitude) return false

    return true
  })

  // Sort by last_location_at (most recent first)
  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    if (!a.last_location_at && !b.last_location_at) return 0
    if (!a.last_location_at) return 1
    if (!b.last_location_at) return -1
    return new Date(b.last_location_at).getTime() - new Date(a.last_location_at).getTime()
  })

  // Stats
  const stats = {
    total: drivers.length,
    withLocation: drivers.filter((d) => d.last_latitude).length,
    noLocation: drivers.filter((d) => !d.last_latitude).length,
    recentlyActive: drivers.filter((d) => {
      if (!d.last_location_at) return false
      const diffMs = Date.now() - new Date(d.last_location_at).getTime()
      return diffMs < 15 * 60 * 1000 // 15 minutes
    }).length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Son Konumlar</h1>
          <p className="text-sm text-gray-500">Tüm şoförlerin son bilinen konumları</p>
        </div>
        <Link
          to="/live-map"
          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
        >
          <MapPinIcon className="h-4 w-4" />
          Canlı Haritayı Aç
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Toplam Şoför</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Konum Bilgisi Var</div>
          <div className="text-2xl font-bold text-green-600">{stats.withLocation}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Konum Bilgisi Yok</div>
          <div className="text-2xl font-bold text-red-600">{stats.noLocation}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Son 15 dk Aktif</div>
          <div className="text-2xl font-bold text-blue-600">{stats.recentlyActive}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Ad, soyad veya telefon ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              Tümü
            </button>
            <button
              onClick={() => setFilter('with_location')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filter === 'with_location'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              Konumu Var
            </button>
            <button
              onClick={() => setFilter('no_location')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filter === 'no_location'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              Konumu Yok
            </button>
          </div>
        </div>
      </div>

      {/* Locations Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Şoför
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Durum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Son Konum
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Koordinatlar
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Son Güncelleme
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedDrivers.map((driver) => {
                const locationAge = getLocationAge(driver.last_location_at)
                return (
                  <tr key={driver.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-700 font-medium text-sm">
                            {driver.name.charAt(0)}
                            {driver.surname.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {driver.name} {driver.surname}
                          </div>
                          <div className="text-xs text-gray-500">{driver.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={clsx(
                          'px-2 py-1 text-xs font-medium rounded-full',
                          statusColors[driver.status] || statusColors.inactive
                        )}
                      >
                        {statusLabels[driver.status] || 'Bilinmiyor'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {driver.province && driver.district
                        ? `${driver.province}, ${driver.district}`
                        : driver.last_latitude
                        ? 'Konum mevcut'
                        : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {driver.last_latitude && driver.last_longitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${driver.last_latitude},${driver.last_longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:text-primary-700 font-mono"
                        >
                          {driver.last_latitude.toFixed(5)}, {driver.last_longitude.toFixed(5)}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <ClockIcon className={clsx('h-4 w-4', locationAgeColors[locationAge])} />
                        <span className={clsx('text-sm', locationAgeColors[locationAge])}>
                          {formatTimeAgo(driver.last_location_at)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Konum İste butonu */}
                        {driver.has_app && (
                          <button
                            onClick={() => locationRequestMutation.mutate(driver.id)}
                            disabled={locationRequestMutation.isPending || requestingLocation === driver.id}
                            className={clsx(
                              'text-xs px-2 py-1 rounded flex items-center gap-1',
                              requestingLocation === driver.id
                                ? 'bg-green-100 text-green-700 animate-pulse'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            )}
                            title="Şoförden anlık konum iste"
                          >
                            <SignalIcon className="h-3 w-3" />
                            {requestingLocation === driver.id ? 'Bekleniyor...' : 'Konum İste'}
                          </button>
                        )}
                        {driver.last_latitude && driver.last_longitude && (
                          <>
                            <a
                              href={`https://www.google.com/maps?q=${driver.last_latitude},${driver.last_longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Haritada Gör
                            </a>
                            <Link
                              to={`/drivers/${driver.id}/route`}
                              className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 flex items-center gap-1"
                            >
                              <MapIcon className="h-3 w-3" />
                              Güzergah
                            </Link>
                          </>
                        )}
                        <Link
                          to={`/drivers/${driver.id}`}
                          className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                        >
                          Detay
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {sortedDrivers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MapPinIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Şoför bulunamadı</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t">
            <div className="text-sm text-gray-500">
              Toplam {total} şoför
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50"
              >
                Önceki
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

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold mb-3">Konum Güncelliği</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-green-600" />
            <span className="text-green-600">Son 15 dk</span>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-yellow-600" />
            <span className="text-yellow-600">15-60 dk</span>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-red-600" />
            <span className="text-red-600">1 saatten fazla</span>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">Konum yok</span>
          </div>
        </div>
      </div>
    </div>
  )
}
