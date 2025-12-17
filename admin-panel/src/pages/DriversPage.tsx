import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { driversApi } from '../services/api'
import {
  UserGroupIcon,
  DevicePhoneMobileIcon,
  MapPinIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  HomeIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import {
  PageHeader,
  Card,
  CardContent,
  SearchInput,
  Badge,
  Select,
  EmptyState,
  LoadingSpinner,
  StatCard,
} from '../components/ui'
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
  last_latitude: number | null
  last_longitude: number | null
  app_version: string | null
  device_os: string | null
  last_active_at: string | null
  has_app: boolean
  app_status: 'active' | 'inactive' | 'stale' | 'never_installed'
}

function formatTimeElapsed(dateString: string | null): string {
  if (!dateString) return '-'
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

const statusConfig = {
  active: { label: 'Aktif', variant: 'success' as const, icon: CheckCircleIcon },
  inactive: { label: 'Pasif', variant: 'default' as const, icon: XCircleIcon },
  passive: { label: 'Pasif', variant: 'default' as const, icon: XCircleIcon },
  on_trip: { label: 'Seferde', variant: 'warning' as const, icon: TruckIcon },
  at_home: { label: 'Evde', variant: 'info' as const, icon: HomeIcon },
}

const appStatusConfig = {
  active: { label: 'Aktif', variant: 'success' as const },
  inactive: { label: 'Beklemede', variant: 'warning' as const },
  stale: { label: 'Silinmiş Olabilir', variant: 'error' as const },
  never_installed: { label: 'Kurulmadı', variant: 'default' as const },
}

const regions = [
  { value: 'all', label: 'Tüm Bölgeler' },
  { value: 'marmara', label: 'Marmara', provinces: ['İstanbul', 'Kocaeli', 'Bursa', 'Balıkesir', 'Çanakkale', 'Edirne', 'Kırklareli', 'Tekirdağ', 'Sakarya', 'Yalova', 'Bilecik'] },
  { value: 'ege', label: 'Ege', provinces: ['İzmir', 'Aydın', 'Denizli', 'Muğla', 'Manisa', 'Afyonkarahisar', 'Kütahya', 'Uşak'] },
  { value: 'akdeniz', label: 'Akdeniz', provinces: ['Antalya', 'Adana', 'Mersin', 'Hatay', 'Kahramanmaraş', 'Osmaniye', 'Burdur', 'Isparta'] },
  { value: 'ic_anadolu', label: 'İç Anadolu', provinces: ['Ankara', 'Konya', 'Kayseri', 'Eskişehir', 'Sivas', 'Yozgat', 'Kırıkkale', 'Aksaray', 'Niğde', 'Nevşehir', 'Kırşehir', 'Karaman', 'Çankırı'] },
  { value: 'karadeniz', label: 'Karadeniz', provinces: ['Samsun', 'Trabzon', 'Ordu', 'Giresun', 'Rize', 'Artvin', 'Gümüşhane', 'Bayburt', 'Tokat', 'Amasya', 'Çorum', 'Sinop', 'Kastamonu', 'Bartın', 'Karabük', 'Zonguldak', 'Bolu', 'Düzce'] },
  { value: 'dogu_anadolu', label: 'Doğu Anadolu', provinces: ['Erzurum', 'Van', 'Malatya', 'Elazığ', 'Ağrı', 'Kars', 'Iğdır', 'Ardahan', 'Muş', 'Bitlis', 'Bingöl', 'Tunceli', 'Erzincan'] },
  { value: 'guneydogu', label: 'Güneydoğu', provinces: ['Gaziantep', 'Diyarbakır', 'Şanlıurfa', 'Mardin', 'Batman', 'Siirt', 'Şırnak', 'Adıyaman', 'Kilis'] },
]

export default function DriversPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [statusFilter, setStatusFilter] = useState('all')
  const [appStatusFilter, setAppStatusFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, limit],
    queryFn: () => driversApi.getAll({ limit, offset: page * limit }),
  })

  const drivers: Driver[] = data?.data?.drivers || []
  const total = data?.data?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Filter logic
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      // Search filter
      const searchMatch =
        driver.name.toLowerCase().includes(search.toLowerCase()) ||
        driver.surname.toLowerCase().includes(search.toLowerCase()) ||
        driver.phone.includes(search)

      if (!searchMatch) return false

      // Status filter
      if (statusFilter !== 'all' && driver.status !== statusFilter) return false

      // App status filter
      if (appStatusFilter !== 'all' && driver.app_status !== appStatusFilter) return false

      // Region filter
      if (regionFilter !== 'all') {
        const region = regions.find(r => r.value === regionFilter)
        if (region && region.provinces && !region.provinces.includes(driver.province)) {
          return false
        }
      }

      return true
    })
  }, [drivers, search, statusFilter, appStatusFilter, regionFilter])

  // Calculate stats
  const stats = useMemo(() => {
    const withApp = drivers.filter(d => d.has_app).length
    const onTrip = drivers.filter(d => d.status === 'on_trip').length
    const atHome = drivers.filter(d => d.status === 'at_home').length
    const active = drivers.filter(d => d.app_status === 'active').length
    return { total: drivers.length, withApp, onTrip, atHome, active }
  }, [drivers])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Şoförler"
        subtitle={`Toplam ${total} şoför kayıtlı`}
        icon={UserGroupIcon}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                showFilters ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <FunnelIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Filtreler</span>
            </button>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  'p-2 transition-colors',
                  viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'bg-white text-gray-500 hover:bg-gray-50'
                )}
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'p-2 transition-colors',
                  viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'bg-white text-gray-500 hover:bg-gray-50'
                )}
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
            </div>
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Toplam Şoför"
          value={stats.total}
          icon={UserGroupIcon}
          color="primary"
        />
        <StatCard
          title="Uygulama Kurulu"
          value={stats.withApp}
          subtitle={`%${stats.total > 0 ? Math.round((stats.withApp / stats.total) * 100) : 0}`}
          icon={DevicePhoneMobileIcon}
          color="green"
        />
        <StatCard
          title="Aktif Kullanım"
          value={stats.active}
          icon={CheckCircleIcon}
          color="blue"
        />
        <StatCard
          title="Seferde"
          value={stats.onTrip}
          icon={TruckIcon}
          color="orange"
        />
        <StatCard
          title="Evde"
          value={stats.atHome}
          icon={HomeIcon}
          color="purple"
        />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Ad, soyad veya telefon ile ara..."
                />
              </div>
            </div>

            {/* Filter Options */}
            {showFilters && (
              <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100">
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'Tüm Durumlar' },
                    { value: 'active', label: 'Aktif' },
                    { value: 'inactive', label: 'Pasif' },
                    { value: 'on_trip', label: 'Seferde' },
                    { value: 'at_home', label: 'Evde' },
                  ]}
                  className="w-40"
                />
                <Select
                  value={appStatusFilter}
                  onChange={setAppStatusFilter}
                  options={[
                    { value: 'all', label: 'Uygulama Durumu' },
                    { value: 'active', label: 'Aktif' },
                    { value: 'inactive', label: 'Beklemede' },
                    { value: 'stale', label: 'Silinmiş Olabilir' },
                    { value: 'never_installed', label: 'Kurulmadı' },
                  ]}
                  className="w-48"
                />
                <Select
                  value={regionFilter}
                  onChange={setRegionFilter}
                  options={regions.map(r => ({ value: r.value, label: r.label }))}
                  className="w-44"
                />
                {(statusFilter !== 'all' || appStatusFilter !== 'all' || regionFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setStatusFilter('all')
                      setAppStatusFilter('all')
                      setRegionFilter('all')
                    }}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Filtreleri Temizle
                  </button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {filteredDrivers.length === 0 ? (
        <EmptyState
          icon={UserGroupIcon}
          title="Şoför bulunamadı"
          description="Arama kriterlerinize uygun şoför bulunmuyor."
        />
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDrivers.map((driver) => (
            <Link
              key={driver.id}
              to={`/drivers/${driver.id}`}
              className="group"
            >
              <Card className="h-full hover:shadow-lg transition-all duration-200 hover:border-primary-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold">
                        {driver.name.charAt(0)}{driver.surname.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                        {driver.name} {driver.surname}
                      </h3>
                      <p className="text-sm text-gray-500">{driver.phone}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant={statusConfig[driver.status]?.variant || 'default'} dot>
                      {statusConfig[driver.status]?.label || 'Bilinmiyor'}
                    </Badge>
                    {driver.has_app && (
                      <Badge variant={appStatusConfig[driver.app_status]?.variant || 'default'} size="sm">
                        <DevicePhoneMobileIcon className="h-3 w-3 mr-1" />
                        {driver.device_os === 'ios' ? 'iOS' : 'Android'}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-500">
                      <MapPinIcon className="h-4 w-4 mr-1" />
                      <span className="truncate">{driver.province || '-'}</span>
                    </div>
                    {driver.last_location_at && (
                      <div className="flex items-center text-gray-400 text-xs">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        {formatTimeElapsed(driver.last_location_at)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        /* List View */
        <Card>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Konum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Uygulama
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                    Son Konum
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">

                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                      {driver.province && driver.district
                        ? `${driver.province}, ${driver.district}`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                      {driver.has_app ? (
                        <div className="flex items-center gap-2">
                          <DevicePhoneMobileIcon className={clsx(
                            'h-5 w-5',
                            driver.device_os === 'ios' ? 'text-gray-600' : 'text-green-600'
                          )} />
                          <div className="text-xs">
                            <div className="font-medium text-gray-900">
                              {driver.device_os === 'ios' ? 'iOS' : 'Android'} v{driver.app_version}
                            </div>
                            <Badge variant={appStatusConfig[driver.app_status]?.variant || 'default'} size="sm">
                              {appStatusConfig[driver.app_status]?.label || 'Bilinmiyor'}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="default" size="sm">Kurulmadı</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={statusConfig[driver.status]?.variant || 'default'} dot>
                        {statusConfig[driver.status]?.label || 'Bilinmiyor'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                      {driver.last_latitude && driver.last_longitude ? (
                        <div className="text-sm">
                          <a
                            href={`https://www.google.com/maps?q=${driver.last_latitude},${driver.last_longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-800 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {driver.last_latitude.toFixed(4)}, {driver.last_longitude.toFixed(4)}
                          </a>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatTimeElapsed(driver.last_location_at)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Veri yok</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/drivers/${driver.id}`}
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-900 font-medium"
                      >
                        <EyeIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Detay</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="px-4 py-3">
            <div className="flex items-center justify-between">
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
                    {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                      const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + idx
                      if (pageNum >= totalPages) return null
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={clsx(
                            'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                            page === pageNum
                              ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          )}
                        >
                          {pageNum + 1}
                        </button>
                      )
                    })}
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
