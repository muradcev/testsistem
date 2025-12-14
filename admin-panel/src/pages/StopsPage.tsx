import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import {
  MapPinIcon,
  ClockIcon,
  TruckIcon,
  CheckCircleIcon,
  PlayIcon,
  HomeIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api, { driverHomesApi } from '../services/api'

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom home marker icon
const homeIcon = L.divIcon({
  html: '<div style="font-size: 24px;">🏠</div>',
  className: 'custom-home-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

interface Stop {
  id: string
  driver_id: string
  driver_name: string
  latitude: number
  longitude: number
  location_type: string
  location_label: string
  address?: string
  province?: string
  district?: string
  started_at: string
  ended_at?: string
  duration_minutes: number
  is_driver_specific?: boolean
}

interface LocationType {
  value: string
  label: string
}

interface DriverHome {
  id: string
  driver_id: string
  driver_name?: string
  name: string
  latitude: number
  longitude: number
  address?: string
  province?: string
  district?: string
  radius: number
  is_active: boolean
  created_at: string
}

const locationTypeIcons: Record<string, string> = {
  home: '🏠',
  loading: '📦',
  unloading: '📤',
  rest_area: '🛏️',
  sleep: '😴',
  gas_station: '⛽',
  truck_garage: '🅿️',
  parking: '🚛',
  industrial: '🏭',
  port: '⚓',
  customs: '🛃',
  mall: '🛒',
  unknown: '❓',
}

export default function StopsPage() {
  const queryClient = useQueryClient()
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [filter, setFilter] = useState<'uncategorized' | 'all' | 'homes'>('uncategorized')
  const [selectedType, setSelectedType] = useState<string>('')
  const [showHomeModal, setShowHomeModal] = useState(false)
  const [editingHome, setEditingHome] = useState<DriverHome | null>(null)
  const [homeForm, setHomeForm] = useState({
    name: '',
    radius: 200,
  })

  // Get location types
  const { data: typesData } = useQuery({
    queryKey: ['location-types'],
    queryFn: () => api.get('/admin/stops/location-types'),
  })

  // Get stops
  const { data: stopsData, isLoading } = useQuery({
    queryKey: ['stops', filter, selectedType],
    queryFn: () => {
      if (filter === 'uncategorized') {
        return api.get('/admin/stops/uncategorized?limit=100')
      }
      if (filter === 'homes') {
        return api.get('/admin/stops?location_type=home&limit=100')
      }
      const params = selectedType ? `?location_type=${selectedType}&limit=100` : '?limit=100'
      return api.get(`/admin/stops${params}`)
    },
    enabled: filter !== 'homes' || filter === 'homes',
  })

  // Get all driver homes
  const { data: homesData, isLoading: homesLoading } = useQuery({
    queryKey: ['driver-homes'],
    queryFn: () => driverHomesApi.getAll({ limit: 100 }),
    enabled: filter === 'homes',
  })

  // Update stop type mutation
  const updateMutation = useMutation({
    mutationFn: ({ stopId, locationType }: { stopId: string; locationType: string }) =>
      api.put(`/admin/stops/${stopId}`, { location_type: locationType }),
    onSuccess: () => {
      toast.success('Durak tipi güncellendi')
      queryClient.invalidateQueries({ queryKey: ['stops'] })
      setSelectedStop(null)
    },
    onError: () => {
      toast.error('Güncelleme başarısız')
    },
  })

  // Detect stops mutation
  const detectMutation = useMutation({
    mutationFn: () => api.post('/admin/stops/detect-all'),
    onSuccess: (res) => {
      toast.success(`${res.data.detected_stops} yeni durak tespit edildi`)
      queryClient.invalidateQueries({ queryKey: ['stops'] })
    },
    onError: () => {
      toast.error('Durak tespiti başarısız')
    },
  })

  // Create home from stop mutation
  const createHomeMutation = useMutation({
    mutationFn: (data: { driverId: string; name: string; latitude: number; longitude: number; province?: string; district?: string; radius: number }) =>
      driverHomesApi.create(data.driverId, {
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        province: data.province,
        district: data.district,
        radius: data.radius,
      }),
    onSuccess: () => {
      toast.success('Ev adresi eklendi')
      queryClient.invalidateQueries({ queryKey: ['driver-homes'] })
      queryClient.invalidateQueries({ queryKey: ['stops'] })
      setShowHomeModal(false)
      setSelectedStop(null)
      setHomeForm({ name: '', radius: 200 })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ev adresi eklenemedi')
    },
  })

  // Delete home mutation
  const deleteHomeMutation = useMutation({
    mutationFn: (homeId: string) => driverHomesApi.delete(homeId),
    onSuccess: () => {
      toast.success('Ev adresi silindi')
      queryClient.invalidateQueries({ queryKey: ['driver-homes'] })
    },
    onError: () => {
      toast.error('Ev adresi silinemedi')
    },
  })

  // Update home mutation
  const updateHomeMutation = useMutation({
    mutationFn: ({ homeId, data }: { homeId: string; data: { name?: string; radius?: number; is_active?: boolean } }) =>
      driverHomesApi.update(homeId, data),
    onSuccess: () => {
      toast.success('Ev adresi güncellendi')
      queryClient.invalidateQueries({ queryKey: ['driver-homes'] })
      setEditingHome(null)
    },
    onError: () => {
      toast.error('Güncelleme başarısız')
    },
  })

  const locationTypes: LocationType[] = typesData?.data?.location_types || []
  const stops: Stop[] = stopsData?.data?.stops || []
  const total = stopsData?.data?.total || 0
  const homes: DriverHome[] = homesData?.data?.homes || []
  const homesTotal = homesData?.data?.total || 0

  const mapCenter: [number, number] = filter === 'homes' && homes.length > 0
    ? [homes[0].latitude, homes[0].longitude]
    : stops.length > 0
      ? [stops[0].latitude, stops[0].longitude]
      : [39.0, 35.0]

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} dk`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}s ${mins}dk`
  }

  const handleSetAsHome = () => {
    if (!selectedStop) return
    setHomeForm({
      name: `Ev`,
      radius: 200,
    })
    setShowHomeModal(true)
  }

  const handleCreateHome = () => {
    if (!selectedStop || !homeForm.name) return
    createHomeMutation.mutate({
      driverId: selectedStop.driver_id,
      name: homeForm.name,
      latitude: selectedStop.latitude,
      longitude: selectedStop.longitude,
      province: selectedStop.province,
      district: selectedStop.district,
      radius: homeForm.radius,
    })
  }

  // Exclude 'home' from location types when categorizing (should use "Set as Home" instead)
  const categorizableTypes = locationTypes.filter(t => t.value !== 'home')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Durak Yönetimi</h1>
          <p className="text-gray-500">Şoför duraklarını kategorize edin ve ev adreslerini yönetin</p>
        </div>
        <button
          onClick={() => detectMutation.mutate()}
          disabled={detectMutation.isPending}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <PlayIcon className="h-5 w-5" />
          {detectMutation.isPending ? 'Tespit Ediliyor...' : 'Durakları Tespit Et'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-4 border-b">
        <button
          onClick={() => { setFilter('uncategorized'); setSelectedType(''); }}
          className={`pb-2 px-4 font-medium ${
            filter === 'uncategorized'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500'
          }`}
        >
          Kategorize Edilmemiş ({total})
        </button>
        <button
          onClick={() => { setFilter('all'); setSelectedType(''); }}
          className={`pb-2 px-4 font-medium ${
            filter === 'all'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500'
          }`}
        >
          Tüm Duraklar
        </button>
        <button
          onClick={() => setFilter('homes')}
          className={`pb-2 px-4 font-medium flex items-center gap-1 ${
            filter === 'homes'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500'
          }`}
        >
          <HomeIcon className="h-4 w-4" />
          Şoför Evleri ({homesTotal})
        </button>

        {filter === 'all' && (
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="ml-auto border border-gray-300 rounded-lg px-3 py-1"
          >
            <option value="">Tüm Tipler</option>
            {locationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {locationTypeIcons[type.value]} {type.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stops/Homes List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">
              {filter === 'homes' ? 'Şoför Ev Adresleri' : 'Duraklar'}
            </h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {(isLoading || (filter === 'homes' && homesLoading)) ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : filter === 'homes' ? (
              homes.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <HomeIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>Henüz ev adresi eklenmemiş</p>
                  <p className="text-sm mt-2">Duralardan "Ev Olarak Kaydet" seçeneğini kullanın</p>
                </div>
              ) : (
                homes.map((home) => (
                  <div
                    key={home.id}
                    className="p-4 border-b hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        <TruckIcon className="h-4 w-4 text-gray-400" />
                        {home.driver_name || 'Şoför'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🏠</span>
                        <button
                          onClick={() => setEditingHome(home)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Bu ev adresini silmek istediğinize emin misiniz?')) {
                              deleteHomeMutation.mutate(home.id)
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 space-y-1">
                      <p className="font-medium text-gray-700">{home.name}</p>
                      <p className="flex items-center gap-1">
                        <MapPinIcon className="h-4 w-4" />
                        {home.province || 'Konum'}, {home.district || ''}
                      </p>
                      <p className="text-xs">
                        Yarıçap: {home.radius}m
                        {!home.is_active && <span className="ml-2 text-red-500">(Pasif)</span>}
                      </p>
                    </div>
                  </div>
                ))
              )
            ) : stops.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>Kategorize edilecek durak yok</p>
              </div>
            ) : (
              stops.map((stop) => (
                <button
                  key={stop.id}
                  onClick={() => setSelectedStop(stop)}
                  className={`w-full text-left p-4 border-b hover:bg-gray-50 ${
                    selectedStop?.id === stop.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium flex items-center gap-2">
                      <TruckIcon className="h-4 w-4 text-gray-400" />
                      {stop.driver_name || 'Bilinmeyen Şoför'}
                    </span>
                    <span className="text-2xl">
                      {locationTypeIcons[stop.location_type] || '❓'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" />
                      {formatDuration(stop.duration_minutes)}
                    </p>
                    <p className="flex items-center gap-1">
                      <MapPinIcon className="h-4 w-4" />
                      {stop.province || 'Konum'}, {stop.district || ''}
                    </p>
                    <p className="text-xs">
                      {new Date(stop.started_at).toLocaleString('tr-TR')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Harita</h2>
          </div>
          <div className="h-[600px]">
            <MapContainer
              center={mapCenter}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filter === 'homes' ? (
                homes.map((home) => (
                  <div key={home.id}>
                    <Marker
                      position={[home.latitude, home.longitude]}
                      icon={homeIcon}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{home.driver_name}</strong>
                          <br />
                          <span className="text-lg">🏠</span> {home.name}
                          <br />
                          Yarıçap: {home.radius}m
                        </div>
                      </Popup>
                    </Marker>
                    <Circle
                      center={[home.latitude, home.longitude]}
                      radius={home.radius}
                      pathOptions={{
                        color: home.is_active ? '#22c55e' : '#ef4444',
                        fillColor: home.is_active ? '#22c55e' : '#ef4444',
                        fillOpacity: 0.2,
                      }}
                    />
                  </div>
                ))
              ) : (
                stops.map((stop) => (
                  <Marker
                    key={stop.id}
                    position={[stop.latitude, stop.longitude]}
                    eventHandlers={{
                      click: () => setSelectedStop(stop),
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>{stop.driver_name}</strong>
                        <br />
                        <span className="text-2xl">{locationTypeIcons[stop.location_type]}</span>{' '}
                        {stop.location_label || 'Belirlenmedi'}
                        <br />
                        Süre: {formatDuration(stop.duration_minutes)}
                        <br />
                        {new Date(stop.started_at).toLocaleString('tr-TR')}
                      </div>
                    </Popup>
                  </Marker>
                ))
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Categorization Modal */}
      {selectedStop && !showHomeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Durak Tipini Seçin</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">{selectedStop.driver_name}</p>
              <p className="text-sm text-gray-500">
                {formatDuration(selectedStop.duration_minutes)} bekledi
              </p>
              <p className="text-sm text-gray-500">
                {selectedStop.province}, {selectedStop.district}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(selectedStop.started_at).toLocaleString('tr-TR')}
              </p>
            </div>

            {/* Save as Home option */}
            <div className="mb-4">
              <button
                onClick={handleSetAsHome}
                className="w-full flex items-center justify-center gap-2 p-3 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 text-green-700"
              >
                <HomeIcon className="h-5 w-5" />
                <span className="font-medium">Bu Şoförün Evi Olarak Kaydet</span>
              </button>
              <p className="text-xs text-gray-500 mt-1 text-center">
                (Her şoför max 2 ev adresi ekleyebilir)
              </p>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-2">Veya diğer tip seçin:</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {categorizableTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => updateMutation.mutate({
                      stopId: selectedStop.id,
                      locationType: type.value,
                    })}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="text-2xl">{locationTypeIcons[type.value]}</span>
                    <span className="text-sm">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedStop(null)}
              className="w-full py-2 text-gray-500 hover:text-gray-700"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Home Creation Modal */}
      {showHomeModal && selectedStop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <HomeIcon className="h-5 w-5 text-green-600" />
              Ev Adresi Ekle
            </h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">{selectedStop.driver_name}</p>
              <p className="text-sm text-gray-500">
                {selectedStop.province}, {selectedStop.district}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {selectedStop.latitude.toFixed(6)}, {selectedStop.longitude.toFixed(6)}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ev Adı
                </label>
                <input
                  type="text"
                  value={homeForm.name}
                  onChange={(e) => setHomeForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ev 1, Ev 2, Ana Ev, vb."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tespit Yarıçapı (metre)
                </label>
                <input
                  type="number"
                  value={homeForm.radius}
                  onChange={(e) => setHomeForm(f => ({ ...f, radius: parseInt(e.target.value) || 200 }))}
                  min={50}
                  max={1000}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Şoför bu yarıçap içinde durunca ev olarak algılanır
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowHomeModal(false)
                  setHomeForm({ name: '', radius: 200 })
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleCreateHome}
                disabled={!homeForm.name || createHomeMutation.isPending}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                {createHomeMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Home Modal */}
      {editingHome && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PencilIcon className="h-5 w-5 text-primary-600" />
              Ev Adresini Düzenle
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ev Adı
                </label>
                <input
                  type="text"
                  value={editingHome.name}
                  onChange={(e) => setEditingHome(h => h ? { ...h, name: e.target.value } : null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tespit Yarıçapı (metre)
                </label>
                <input
                  type="number"
                  value={editingHome.radius}
                  onChange={(e) => setEditingHome(h => h ? { ...h, radius: parseInt(e.target.value) || 200 } : null)}
                  min={50}
                  max={1000}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingHome.is_active}
                  onChange={(e) => setEditingHome(h => h ? { ...h, is_active: e.target.checked } : null)}
                  className="h-4 w-4 text-primary-600 rounded"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Aktif (Durak tespitinde kullanılsın)
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditingHome(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  if (editingHome) {
                    updateHomeMutation.mutate({
                      homeId: editingHome.id,
                      data: {
                        name: editingHome.name,
                        radius: editingHome.radius,
                        is_active: editingHome.is_active,
                      },
                    })
                  }
                }}
                disabled={updateHomeMutation.isPending}
                className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {updateHomeMutation.isPending ? 'Kaydediliyor...' : 'Güncelle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
