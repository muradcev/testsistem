import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { locationsApi, driversApi, stopsApi } from '../services/api'
import {
  MapPinIcon,
  ClockIcon,
  FunnelIcon,
  HomeIcon,
  TruckIcon,
  BuildingOfficeIcon,
  CubeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface LocationEntry {
  id: number
  driver_id: string
  driver_name: string
  latitude: number
  longitude: number
  province?: string
  district?: string
  stay_duration: number // minutes
  is_moving: boolean
  activity_type: string
  stop_id?: string
  location_type?: string
  location_label?: string
  recorded_at: string
}

const stopTypeOptions = [
  { value: 'home', label: 'Ev', icon: HomeIcon, color: 'blue' },
  { value: 'loading', label: 'Yükleme', icon: CubeIcon, color: 'green' },
  { value: 'unloading', label: 'Boşaltma', icon: CubeIcon, color: 'orange' },
  { value: 'rest', label: 'Mola', icon: ClockIcon, color: 'purple' },
  { value: 'fuel', label: 'Akaryakıt', icon: TruckIcon, color: 'yellow' },
  { value: 'warehouse', label: 'Depo', icon: BuildingOfficeIcon, color: 'gray' },
]

function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 dk'
  if (minutes < 60) return `${minutes} dk`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours} saat`
  return `${hours} saat ${mins} dk`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LocationTrackingPage() {
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [onlyStationary, setOnlyStationary] = useState(true)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [bulkStopType, setBulkStopType] = useState<string>('')
  const [page, setPage] = useState(0)
  const limit = 50
  const queryClient = useQueryClient()

  // Fetch drivers for filter
  const { data: driversData } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => driversApi.getAll({ limit: 500, offset: 0 }),
  })
  const drivers = driversData?.data?.drivers || []

  // Fetch locations
  const { data: locationsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-locations', selectedDriver, startDate, endDate, onlyStationary, page],
    queryFn: () =>
      locationsApi.getAdminLocations({
        driver_id: selectedDriver || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        only_stationary: onlyStationary,
        limit,
        offset: page * limit,
      }),
  })

  const locations: LocationEntry[] = locationsData?.data?.locations || []
  const total = locationsData?.data?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Assign stop type mutation
  const assignStopMutation = useMutation({
    mutationFn: ({ stopId, stopType, driverId, latitude, longitude }: {
      stopId?: string
      stopType: string
      driverId: string
      latitude: number
      longitude: number
    }) => {
      // If stop exists, update it. Otherwise create new stop.
      if (stopId) {
        return stopsApi.updateType(stopId, stopType)
      } else {
        return stopsApi.create({
          driver_id: driverId,
          latitude,
          longitude,
          location_type: stopType,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-locations'] })
    },
  })

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async (stopType: string) => {
      const selectedLocations = locations.filter((loc) => selectedRows.has(loc.id))

      // Separate locations with and without stops
      const withStops = selectedLocations.filter((loc) => loc.stop_id)
      const withoutStops = selectedLocations.filter((loc) => !loc.stop_id)

      const promises: Promise<unknown>[] = []

      // Update existing stops
      if (withStops.length > 0) {
        promises.push(
          stopsApi.bulkUpdateType(
            withStops.map((loc) => loc.stop_id!),
            stopType
          )
        )
      }

      // Create new stops for locations without stops
      withoutStops.forEach((loc) => {
        promises.push(
          stopsApi.create({
            driver_id: loc.driver_id,
            latitude: loc.latitude,
            longitude: loc.longitude,
            location_type: stopType,
          })
        )
      })

      return Promise.all(promises)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-locations'] })
      setSelectedRows(new Set())
      setBulkStopType('')
    },
  })

  const toggleRowSelection = (id: number) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRows(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedRows.size === locations.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(locations.map((loc) => loc.id)))
    }
  }

  // Stats
  const stats = {
    total,
    withStopType: locations.filter((loc) => loc.location_type).length,
    withoutStopType: locations.filter((loc) => !loc.location_type).length,
    selected: selectedRows.size,
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Konum Takibi</h1>
          <p className="text-sm text-gray-500">Şoför konumlarını görüntüle ve durak tipi ata</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Yenile
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-3">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <span className="font-medium text-gray-700">Filtreler</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Driver Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şoför</label>
            <select
              value={selectedDriver}
              onChange={(e) => {
                setSelectedDriver(e.target.value)
                setPage(0)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Tüm Şoförler</option>
              {drivers.map((driver: { id: string; name: string; surname: string }) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} {driver.surname}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(0)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(0)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Only Stationary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
            <select
              value={onlyStationary ? 'stationary' : 'all'}
              onChange={(e) => {
                setOnlyStationary(e.target.value === 'stationary')
                setPage(0)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="stationary">Sadece Duraklamalar</option>
              <option value="all">Tümü</option>
            </select>
          </div>

          {/* Bulk Actions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Toplu İşlem ({selectedRows.size} seçili)
            </label>
            <div className="flex gap-2">
              <select
                value={bulkStopType}
                onChange={(e) => setBulkStopType(e.target.value)}
                disabled={selectedRows.size === 0}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              >
                <option value="">Tip Seç</option>
                {stopTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => bulkAssignMutation.mutate(bulkStopType)}
                disabled={!bulkStopType || selectedRows.size === 0 || bulkAssignMutation.isPending}
                className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {bulkAssignMutation.isPending ? '...' : 'Uygula'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Toplam Kayıt</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Tipi Atanmış</div>
          <div className="text-2xl font-bold text-green-600">{stats.withStopType}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Tipi Atanmamış</div>
          <div className="text-2xl font-bold text-orange-600">{stats.withoutStopType}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Seçili</div>
          <div className="text-2xl font-bold text-primary-600">{stats.selected}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === locations.length && locations.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Şoför
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Konum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Koordinatlar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Bekleme
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Durak Tipi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {locations.map((loc) => {
                  const isSelected = selectedRows.has(loc.id)
                  const stopType = stopTypeOptions.find((s) => s.value === loc.location_type)

                  return (
                    <tr
                      key={loc.id}
                      className={clsx('hover:bg-gray-50', isSelected && 'bg-primary-50')}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(loc.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-700 font-medium text-xs">
                              {loc.driver_name
                                ?.split(' ')
                                .map((n) => n.charAt(0))
                                .join('')
                                .slice(0, 2)}
                            </span>
                          </div>
                          <span className="ml-2 text-sm font-medium text-gray-900">
                            {loc.driver_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {loc.province && loc.district ? (
                          `${loc.province}, ${loc.district}`
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <a
                          href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary-600 hover:text-primary-700 font-mono"
                        >
                          {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                        </a>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {formatDuration(loc.stay_duration)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(loc.recorded_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {loc.location_type ? (
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full',
                              stopType?.color === 'blue' && 'bg-blue-100 text-blue-800',
                              stopType?.color === 'green' && 'bg-green-100 text-green-800',
                              stopType?.color === 'orange' && 'bg-orange-100 text-orange-800',
                              stopType?.color === 'purple' && 'bg-purple-100 text-purple-800',
                              stopType?.color === 'yellow' && 'bg-yellow-100 text-yellow-800',
                              stopType?.color === 'gray' && 'bg-gray-100 text-gray-800'
                            )}
                          >
                            {stopType && <stopType.icon className="h-3 w-3" />}
                            {stopType?.label || loc.location_type}
                          </span>
                        ) : (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                assignStopMutation.mutate({
                                  stopId: loc.stop_id,
                                  stopType: e.target.value,
                                  driverId: loc.driver_id,
                                  latitude: loc.latitude,
                                  longitude: loc.longitude,
                                })
                              }
                            }}
                            disabled={assignStopMutation.isPending}
                            className="text-xs px-2 py-1 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">Tip Seç</option>
                            {stopTypeOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && locations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MapPinIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Konum kaydı bulunamadı</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t">
            <div className="text-sm text-gray-500">Toplam {total} kayıt</div>
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
        <h3 className="text-sm font-semibold mb-3">Durak Tipleri</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          {stopTypeOptions.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <opt.icon
                className={clsx(
                  'h-4 w-4',
                  opt.color === 'blue' && 'text-blue-600',
                  opt.color === 'green' && 'text-green-600',
                  opt.color === 'orange' && 'text-orange-600',
                  opt.color === 'purple' && 'text-purple-600',
                  opt.color === 'yellow' && 'text-yellow-600',
                  opt.color === 'gray' && 'text-gray-600'
                )}
              />
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
