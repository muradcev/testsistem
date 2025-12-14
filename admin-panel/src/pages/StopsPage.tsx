import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import {
  MapPinIcon,
  ClockIcon,
  TruckIcon,
  CheckCircleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../services/api'

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
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
}

interface LocationType {
  value: string
  label: string
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
  const [filter, setFilter] = useState<'uncategorized' | 'all'>('uncategorized')
  const [selectedType, setSelectedType] = useState<string>('')

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
      const params = selectedType ? `?location_type=${selectedType}&limit=100` : '?limit=100'
      return api.get(`/admin/stops${params}`)
    },
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

  const locationTypes: LocationType[] = typesData?.data?.location_types || []
  const stops: Stop[] = stopsData?.data?.stops || []
  const total = stopsData?.data?.total || 0

  const mapCenter: [number, number] = stops.length > 0
    ? [stops[0].latitude, stops[0].longitude]
    : [39.0, 35.0]

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} dk`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}s ${mins}dk`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Durak Yönetimi</h1>
          <p className="text-gray-500">Şoför duraklarını kategorize edin</p>
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
          onClick={() => setFilter('all')}
          className={`pb-2 px-4 font-medium ${
            filter === 'all'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500'
          }`}
        >
          Tüm Duraklar
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
        {/* Stops List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Duraklar</h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
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
              {stops.map((stop) => (
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
              ))}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Categorization Modal */}
      {selectedStop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Durak Tipini Seçin</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">{selectedStop.driver_name}</p>
              <p className="text-sm text-gray-500">
                {formatDuration(selectedStop.duration_minutes)} bekledi
              </p>
              <p className="text-sm text-gray-500">
                {new Date(selectedStop.started_at).toLocaleString('tr-TR')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {locationTypes.map((type) => (
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

            <button
              onClick={() => setSelectedStop(null)}
              className="w-full py-2 text-gray-500 hover:text-gray-700"
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
