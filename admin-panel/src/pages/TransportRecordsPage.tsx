import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { transportRecordsApi, driversApi } from '../services/api'
import {
  TruckIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  CalendarIcon,
  ChartBarIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ArrowPathIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import toast from 'react-hot-toast'

interface TransportRecord {
  id: string
  driver_id: string
  plate: string | null
  trailer_type: string | null
  origin_province: string | null
  origin_district: string | null
  destination_province: string | null
  destination_district: string | null
  transport_date: string | null
  price: number | null
  currency: string
  cargo_type: string | null
  cargo_weight: number | null
  distance_km: number | null
  notes: string | null
  source_type: string
  created_at: string
  driver_name: string
  driver_surname: string
  driver_phone: string
  driver_province: string | null
}

interface TransportStats {
  total_records: number
  total_drivers: number
  total_price: number
  average_price: number
  min_price: number
  max_price: number
  total_distance: number
  top_origins: Array<{ province: string; count: number }>
  top_destinations: Array<{ province: string; count: number }>
  top_routes: Array<{
    origin: string
    destination: string
    count: number
    avg_price: number
    min_price: number
    max_price: number
  }>
  trailer_type_stats: Array<{
    trailer_type: string
    count: number
    avg_price: number
  }>
}

interface TrailerTypeRef {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

interface Driver {
  id: string
  name: string
  surname: string
  phone: string
}

const provinces = [
  'Adana', 'Adiyaman', 'Afyonkarahisar', 'Agri', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
  'Ardahan', 'Artvin', 'Aydin', 'Balikesir', 'Bartin', 'Batman', 'Bayburt', 'Bilecik',
  'Bingol', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Canakkale', 'Cankiri', 'Corum',
  'Denizli', 'Diyarbakir', 'Duzce', 'Edirne', 'Elazig', 'Erzincan', 'Erzurum', 'Eskisehir',
  'Gaziantep', 'Giresun', 'Gumushane', 'Hakkari', 'Hatay', 'Igdir', 'Isparta', 'Istanbul',
  'Izmir', 'Kahramanmaras', 'Karabuk', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis',
  'Kirikkale', 'Kirklareli', 'Kirsehir', 'Kocaeli', 'Konya', 'Kutahya', 'Malatya', 'Manisa',
  'Mardin', 'Mersin', 'Mugla', 'Mus', 'Nevsehir', 'Nigde', 'Ordu', 'Osmaniye',
  'Rize', 'Sakarya', 'Samsun', 'Sanliurfa', 'Siirt', 'Sinop', 'Sirnak', 'Sivas',
  'Tekirdag', 'Tokat', 'Trabzon', 'Tunceli', 'Usak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
]

function formatPrice(price: number | null, currency: string = 'TRY'): string {
  if (price === null) return '-'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0,
  }).format(price)
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function TransportRecordsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<TransportRecord | null>(null)
  const [showStats, setShowStats] = useState(true)
  const limit = 50

  // Filters
  const [filterOrigin, setFilterOrigin] = useState('')
  const [filterDestination, setFilterDestination] = useState('')
  const [filterTrailerType, setFilterTrailerType] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transport-records', page, filterOrigin, filterDestination, filterTrailerType, filterStartDate, filterEndDate],
    queryFn: () => transportRecordsApi.getAll({
      limit,
      offset: page * limit,
      origin_province: filterOrigin || undefined,
      destination_province: filterDestination || undefined,
      trailer_type: filterTrailerType || undefined,
      start_date: filterStartDate || undefined,
      end_date: filterEndDate || undefined,
    }),
  })

  const { data: statsData } = useQuery({
    queryKey: ['transport-stats'],
    queryFn: () => transportRecordsApi.getStats(),
  })

  const { data: trailerTypesData } = useQuery({
    queryKey: ['trailer-types'],
    queryFn: () => transportRecordsApi.getTrailerTypes(),
  })

  const { data: driversData } = useQuery({
    queryKey: ['drivers-for-transport'],
    queryFn: () => driversApi.getAll({ limit: 200 }),
  })

  const records: TransportRecord[] = data?.data?.records || []
  const total = data?.data?.total || 0
  const totalPages = Math.ceil(total / limit)
  const stats: TransportStats | null = statsData?.data || null
  const trailerTypes: TrailerTypeRef[] = trailerTypesData?.data?.trailer_types || []
  const drivers: Driver[] = driversData?.data?.drivers || []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transportRecordsApi.delete(id),
    onSuccess: () => {
      toast.success('Kayit silindi')
      queryClient.invalidateQueries({ queryKey: ['transport-records'] })
      queryClient.invalidateQueries({ queryKey: ['transport-stats'] })
    },
    onError: () => {
      toast.error('Silme islemi basarisiz')
    },
  })

  const handleDelete = (id: string) => {
    if (confirm('Bu kaydi silmek istediginize emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  const clearFilters = () => {
    setFilterOrigin('')
    setFilterDestination('')
    setFilterTrailerType('')
    setFilterStartDate('')
    setFilterEndDate('')
    setPage(0)
  }

  const hasActiveFilters = filterOrigin || filterDestination || filterTrailerType || filterStartDate || filterEndDate

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
          <h1 className="text-2xl font-bold text-gray-900">Fiyat Raporlari</h1>
          <p className="text-gray-500">Tasima kayitlari ve fiyat analizleri</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              showStats ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
            )}
          >
            <ChartBarIcon className="h-5 w-5" />
            Istatistikler
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              showFilters ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
            )}
          >
            <FunnelIcon className="h-5 w-5" />
            Filtreler
            {hasActiveFilters && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">!</span>
            )}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5" />
            Yeni Kayit
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {showStats && stats && (
        <div className="space-y-4">
          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Toplam Kayit</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_records}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Sofor Sayisi</div>
              <div className="text-2xl font-bold text-blue-600">{stats.total_drivers}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Toplam Ciro</div>
              <div className="text-2xl font-bold text-green-600">{formatPrice(stats.total_price)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Ortalama Fiyat</div>
              <div className="text-2xl font-bold text-purple-600">{formatPrice(stats.average_price)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <ArrowTrendingDownIcon className="h-4 w-4" /> Min
              </div>
              <div className="text-2xl font-bold text-orange-600">{formatPrice(stats.min_price)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <ArrowTrendingUpIcon className="h-4 w-4" /> Max
              </div>
              <div className="text-2xl font-bold text-red-600">{formatPrice(stats.max_price)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Toplam Mesafe</div>
              <div className="text-2xl font-bold text-indigo-600">{stats.total_distance.toLocaleString('tr-TR')} km</div>
            </div>
          </div>

          {/* Route Stats */}
          {stats.top_routes && stats.top_routes.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">En Populer Guzergahlar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.top_routes.slice(0, 6).map((route, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <MapPinIcon className="h-4 w-4 text-green-600" />
                      {route.origin}
                      <span className="text-gray-400">→</span>
                      <MapPinIcon className="h-4 w-4 text-red-600" />
                      {route.destination}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 flex items-center gap-3">
                      <span>{route.count} sefer</span>
                      <span>Ort: {formatPrice(route.avg_price)}</span>
                      <span>{formatPrice(route.min_price)} - {formatPrice(route.max_price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trailer Type Stats */}
          {stats.trailer_type_stats && stats.trailer_type_stats.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Dorse Tiplerine Gore</h3>
              <div className="flex flex-wrap gap-3">
                {stats.trailer_type_stats.map((ts, idx) => (
                  <div key={idx} className="px-4 py-2 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-blue-900">{ts.trailer_type}</div>
                    <div className="text-xs text-blue-600">{ts.count} kayit • Ort: {formatPrice(ts.avg_price)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filtreler</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Filtreleri Temizle
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yukleme Ili</label>
              <select
                value={filterOrigin}
                onChange={(e) => { setFilterOrigin(e.target.value); setPage(0) }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Tumu</option>
                {provinces.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teslim Ili</label>
              <select
                value={filterDestination}
                onChange={(e) => { setFilterDestination(e.target.value); setPage(0) }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Tumu</option>
                {provinces.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dorse Tipi</label>
              <select
                value={filterTrailerType}
                onChange={(e) => { setFilterTrailerType(e.target.value); setPage(0) }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Tumu</option>
                {trailerTypes.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Baslangic Tarihi</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setPage(0) }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bitis Tarihi</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setPage(0) }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sofor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plaka</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guzergah</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dorse</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fiyat</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mesafe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Islemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link to={`/drivers/${record.driver_id}`} className="flex items-center hover:text-primary-600">
                      <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <TruckIcon className="h-4 w-4 text-primary-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{record.driver_name} {record.driver_surname}</div>
                        <div className="text-xs text-gray-500">{record.driver_phone}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">{record.plate || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm">
                      <MapPinIcon className="h-4 w-4 text-green-600" />
                      <span className="text-gray-900">{record.origin_province || '-'}</span>
                      {record.origin_district && (
                        <span className="text-gray-400 text-xs">/ {record.origin_district}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm mt-1">
                      <MapPinIcon className="h-4 w-4 text-red-600" />
                      <span className="text-gray-900">{record.destination_province || '-'}</span>
                      {record.destination_district && (
                        <span className="text-gray-400 text-xs">/ {record.destination_district}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {record.trailer_type ? (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {record.trailer_type}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <CalendarIcon className="h-4 w-4" />
                      {formatDate(record.transport_date)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
                      <CurrencyDollarIcon className="h-4 w-4" />
                      {formatPrice(record.price, record.currency)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {record.distance_km ? `${record.distance_km.toLocaleString('tr-TR')} km` : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingRecord(record)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        title="Duzenle"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Sil"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {records.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <TruckIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Tasima kaydi bulunamadi</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t">
            <div className="text-sm text-gray-500">Toplam {total} kayit</div>
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

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRecord) && (
        <RecordModal
          record={editingRecord}
          drivers={drivers}
          trailerTypes={trailerTypes}
          onClose={() => {
            setShowCreateModal(false)
            setEditingRecord(null)
          }}
          onSuccess={() => {
            setShowCreateModal(false)
            setEditingRecord(null)
            refetch()
            queryClient.invalidateQueries({ queryKey: ['transport-stats'] })
          }}
        />
      )}
    </div>
  )
}

interface RecordModalProps {
  record: TransportRecord | null
  drivers: Driver[]
  trailerTypes: TrailerTypeRef[]
  onClose: () => void
  onSuccess: () => void
}

function RecordModal({ record, drivers, trailerTypes, onClose, onSuccess }: RecordModalProps) {
  const [formData, setFormData] = useState({
    driver_id: record?.driver_id || '',
    plate: record?.plate || '',
    trailer_type: record?.trailer_type || '',
    origin_province: record?.origin_province || '',
    origin_district: record?.origin_district || '',
    destination_province: record?.destination_province || '',
    destination_district: record?.destination_district || '',
    transport_date: record?.transport_date ? record.transport_date.split('T')[0] : '',
    price: record?.price?.toString() || '',
    currency: record?.currency || 'TRY',
    cargo_type: record?.cargo_type || '',
    cargo_weight: record?.cargo_weight?.toString() || '',
    distance_km: record?.distance_km?.toString() || '',
    notes: record?.notes || '',
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const payload = {
        driver_id: data.driver_id,
        plate: data.plate || undefined,
        trailer_type: data.trailer_type || undefined,
        origin_province: data.origin_province || undefined,
        origin_district: data.origin_district || undefined,
        destination_province: data.destination_province || undefined,
        destination_district: data.destination_district || undefined,
        transport_date: data.transport_date || undefined,
        price: data.price ? parseFloat(data.price) : undefined,
        currency: data.currency || undefined,
        cargo_type: data.cargo_type || undefined,
        cargo_weight: data.cargo_weight ? parseFloat(data.cargo_weight) : undefined,
        distance_km: data.distance_km ? parseInt(data.distance_km) : undefined,
        notes: data.notes || undefined,
      }
      return transportRecordsApi.create(payload)
    },
    onSuccess: () => {
      toast.success('Kayit olusturuldu')
      onSuccess()
    },
    onError: () => {
      toast.error('Kayit olusturulamadi')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const payload = {
        plate: data.plate || undefined,
        trailer_type: data.trailer_type || undefined,
        origin_province: data.origin_province || undefined,
        origin_district: data.origin_district || undefined,
        destination_province: data.destination_province || undefined,
        destination_district: data.destination_district || undefined,
        transport_date: data.transport_date || undefined,
        price: data.price ? parseFloat(data.price) : undefined,
        currency: data.currency || undefined,
        cargo_type: data.cargo_type || undefined,
        cargo_weight: data.cargo_weight ? parseFloat(data.cargo_weight) : undefined,
        distance_km: data.distance_km ? parseInt(data.distance_km) : undefined,
        notes: data.notes || undefined,
      }
      return transportRecordsApi.update(record!.id, payload)
    },
    onSuccess: () => {
      toast.success('Kayit guncellendi')
      onSuccess()
    },
    onError: () => {
      toast.error('Kayit guncellenemedi')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.driver_id) {
      toast.error('Sofor secimi zorunludur')
      return
    }
    if (record) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {record ? 'Kayit Duzenle' : 'Yeni Tasima Kaydi'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Driver Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sofor *</label>
            <select
              value={formData.driver_id}
              onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
              disabled={!!record}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
              required
            >
              <option value="">Sofor Secin</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name} {d.surname} - {d.phone}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Plate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plaka</label>
              <input
                type="text"
                value={formData.plate}
                onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="34 ABC 123"
              />
            </div>

            {/* Trailer Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dorse Tipi</label>
              <select
                value={formData.trailer_type}
                onChange={(e) => setFormData({ ...formData, trailer_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Seciniz</option>
                {trailerTypes.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Origin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yukleme Ili</label>
              <select
                value={formData.origin_province}
                onChange={(e) => setFormData({ ...formData, origin_province: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Seciniz</option>
                {provinces.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Destination */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teslim Ili</label>
              <select
                value={formData.destination_province}
                onChange={(e) => setFormData({ ...formData, destination_province: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Seciniz</option>
                {provinces.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Origin District */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yukleme Ilcesi</label>
              <input
                type="text"
                value={formData.origin_district}
                onChange={(e) => setFormData({ ...formData, origin_district: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Ilce adi"
              />
            </div>

            {/* Destination District */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teslim Ilcesi</label>
              <input
                type="text"
                value={formData.destination_district}
                onChange={(e) => setFormData({ ...formData, destination_district: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Ilce adi"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Transport Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tasima Tarihi</label>
              <input
                type="date"
                value={formData.transport_date}
                onChange={(e) => setFormData({ ...formData, transport_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fiyat (TL)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="0"
                min="0"
              />
            </div>

            {/* Distance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mesafe (km)</label>
              <input
                type="number"
                value={formData.distance_km}
                onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Cargo Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yuk Tipi</label>
              <input
                type="text"
                value={formData.cargo_type}
                onChange={(e) => setFormData({ ...formData, cargo_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Orn: Gida, Insaat malzemesi"
              />
            </div>

            {/* Cargo Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yuk Agirligi (ton)</label>
              <input
                type="number"
                step="0.1"
                value={formData.cargo_weight}
                onChange={(e) => setFormData({ ...formData, cargo_weight: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Ek bilgiler..."
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Iptal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {record ? 'Guncelle' : 'Olustur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
