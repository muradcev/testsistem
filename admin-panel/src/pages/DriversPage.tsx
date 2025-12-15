import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { driversApi } from '../services/api'
import {
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface Driver {
  id: string
  name: string
  surname: string
  phone: string
  email: string
  status: 'active' | 'inactive' | 'on_trip' | 'at_home'
  province: string
  district: string
  created_at: string
  last_location_at: string | null
  app_version: string | null
  device_os: string | null
  last_active_at: string | null
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

export default function DriversPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, limit],
    queryFn: () => driversApi.getAll({ limit, offset: page * limit }),
  })

  const drivers: Driver[] = data?.data?.drivers || []
  const total = data?.data?.total || 0
  const totalPages = Math.ceil(total / limit)

  const filteredDrivers = drivers.filter(
    (driver) =>
      driver.name.toLowerCase().includes(search.toLowerCase()) ||
      driver.surname.toLowerCase().includes(search.toLowerCase()) ||
      driver.phone.includes(search)
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Şoförler</h1>
        <div className="text-sm text-gray-500">
          Toplam: {total} şoför
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Ad, soyad veya telefon ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-3">
        {filteredDrivers.map((driver) => (
          <Link
            key={driver.id}
            to={`/drivers/${driver.id}`}
            className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-700 font-medium text-sm">
                    {driver.name.charAt(0)}{driver.surname.charAt(0)}
                  </span>
                </div>
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">
                    {driver.name} {driver.surname}
                  </div>
                  <div className="text-xs text-gray-500">{driver.phone}</div>
                </div>
              </div>
              <span
                className={clsx(
                  'px-2 py-1 text-xs font-medium rounded-full',
                  statusColors[driver.status] || statusColors.inactive
                )}
              >
                {statusLabels[driver.status] || 'Bilinmiyor'}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <div>
                {driver.province && driver.district
                  ? `${driver.province}, ${driver.district}`
                  : '-'}
              </div>
              {driver.has_app && (
                <div className="flex items-center">
                  <DevicePhoneMobileIcon className={clsx(
                    'h-4 w-4 mr-1',
                    driver.device_os === 'ios' ? 'text-gray-600' : 'text-green-600'
                  )} />
                  <span>{driver.device_os === 'ios' ? 'iOS' : 'Android'}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Şoför
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Telefon
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Konum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uygulama
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Son Aktif
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDrivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-medium">
                          {driver.name.charAt(0)}{driver.surname.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {driver.name} {driver.surname}
                        </div>
                        <div className="text-sm text-gray-500">{driver.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {driver.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {driver.province && driver.district
                      ? `${driver.province}, ${driver.district}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {driver.has_app ? (
                      <div className="flex items-center">
                        <DevicePhoneMobileIcon className={clsx(
                          'h-5 w-5 mr-1',
                          driver.device_os === 'ios' ? 'text-gray-600' : 'text-green-600'
                        )} />
                        <div className="text-xs">
                          <div className="font-medium text-gray-900">
                            {driver.device_os === 'ios' ? 'iOS' : 'Android'}
                          </div>
                          <div className="text-gray-500">v{driver.app_version}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Yüklü değil</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={clsx(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        statusColors[driver.status] || statusColors.inactive
                      )}
                    >
                      {statusLabels[driver.status] || 'Bilinmiyor'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {driver.last_active_at
                      ? new Date(driver.last_active_at).toLocaleString('tr-TR')
                      : driver.last_location_at
                      ? new Date(driver.last_location_at).toLocaleString('tr-TR')
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/drivers/${driver.id}`}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      Detay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDrivers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Şoför bulunamadı
          </div>
        )}
      </div>

      {/* Mobile empty state */}
      {filteredDrivers.length === 0 && (
        <div className="lg:hidden text-center py-12 text-gray-500 bg-white rounded-lg shadow">
          Şoför bulunamadı
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 rounded-lg shadow">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Önceki
            </button>
            <span className="flex items-center text-sm text-gray-500">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                <span className="font-medium">{page * limit + 1}</span>
                {' - '}
                <span className="font-medium">
                  {Math.min((page + 1) * limit, total)}
                </span>
                {' / '}
                <span className="font-medium">{total}</span> sonuç
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
