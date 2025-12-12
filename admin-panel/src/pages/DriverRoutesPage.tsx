import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  CircleMarker,
} from 'react-leaflet'
import {
  ArrowLeftIcon,
  CalendarIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../services/api'

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface Route {
  trip_id: string
  start_latitude: number
  start_longitude: number
  start_province: string
  end_latitude: number
  end_longitude: number
  end_province: string
  distance_km: number
  duration_minutes: number
  started_at: string
  ended_at: string | null
  status: string
  cargo_type: string | null
  weight_tons: number | null
  price: number | null
}

interface TripLocation {
  latitude: number
  longitude: number
  speed: number
  recorded_at: string
}

interface TripStop {
  id: string
  latitude: number
  longitude: number
  location_type: string
  address: string
  province: string
  district: string
  started_at: string
  ended_at: string | null
  duration_minutes: number
  cargo_action: string | null
}

export default function DriverRoutesPage() {
  const { id: driverId } = useParams<{ id: string }>()
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })

  // Şoför güzergahları
  const { data: routesData, isLoading } = useQuery({
    queryKey: ['driver-routes', driverId, dateRange],
    queryFn: () =>
      api.get(`/admin/analytics/drivers/${driverId}/routes`, {
        params: {
          start_date: dateRange.start,
          end_date: dateRange.end,
        },
      }),
    enabled: !!driverId,
  })

  // Seçili sefer detayları
  const { data: tripDetails } = useQuery({
    queryKey: ['trip-details', selectedTrip],
    queryFn: () => api.get(`/admin/analytics/trips/${selectedTrip}/details`),
    enabled: !!selectedTrip,
  })

  const routes: Route[] = routesData?.data?.routes || []
  const tripLocations: TripLocation[] = tripDetails?.data?.locations || []
  const tripStops: TripStop[] = tripDetails?.data?.stops || []

  // Harita merkezi
  const getMapCenter = (): [number, number] => {
    if (selectedTrip && tripLocations.length > 0) {
      return [tripLocations[0].latitude, tripLocations[0].longitude]
    }
    if (routes.length > 0 && routes[0].start_latitude) {
      return [routes[0].start_latitude, routes[0].start_longitude]
    }
    return [39.0, 35.0]
  }

  // Rota çizgisi
  const routePath: [number, number][] = tripLocations.map((loc) => [
    loc.latitude,
    loc.longitude,
  ])

  // Stop marker renkleri
  const getStopColor = (locationType: string) => {
    switch (locationType) {
      case 'loading':
        return '#22c55e' // green
      case 'unloading':
        return '#ef4444' // red
      case 'rest_area':
        return '#3b82f6' // blue
      case 'gas_station':
        return '#f97316' // orange
      case 'parking':
        return '#6b7280' // gray
      default:
        return '#8b5cf6' // purple
    }
  }

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
      <div className="flex items-center gap-4">
        <Link
          to={`/drivers/${driverId}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Şoför Güzergahları</h1>
          <p className="text-gray-500">Tüm seferleri ve rotaları görüntüleyin</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <CalendarIcon className="h-5 w-5 text-gray-400" />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
              }
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <span className="text-sm text-gray-500">
            {routes.length} sefer bulundu
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Routes List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Seferler</h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {routes.map((route) => (
              <button
                key={route.trip_id}
                onClick={() => setSelectedTrip(route.trip_id)}
                className={`w-full text-left p-4 border-b hover:bg-gray-50 ${
                  selectedTrip === route.trip_id ? 'bg-primary-50' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {route.start_province} → {route.end_province || '?'}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      route.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {route.status === 'completed' ? 'Tamamlandı' : 'Devam Ediyor'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>
                    {new Date(route.started_at).toLocaleString('tr-TR')}
                  </p>
                  <p>
                    {route.distance_km?.toFixed(1)} km • {route.duration_minutes} dk
                  </p>
                  {route.cargo_type && (
                    <p className="text-primary-600">Yük: {route.cargo_type}</p>
                  )}
                  {route.price && (
                    <p className="text-green-600 font-medium">{route.price} ₺</p>
                  )}
                </div>
              </button>
            ))}

            {routes.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                Bu tarih aralığında sefer bulunamadı
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">
              {selectedTrip ? 'Sefer Detayı' : 'Harita'}
            </h2>
            {selectedTrip && (
              <button
                onClick={() => setSelectedTrip(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Temizle
              </button>
            )}
          </div>
          <div className="h-[600px]">
            <MapContainer
              center={getMapCenter()}
              zoom={selectedTrip ? 10 : 6}
              style={{ height: '100%', width: '100%' }}
              key={selectedTrip || 'default'}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Seçili sefer rotası */}
              {selectedTrip && routePath.length > 1 && (
                <>
                  <Polyline
                    positions={routePath}
                    color="#3b82f6"
                    weight={4}
                    opacity={0.8}
                  />

                  {/* Başlangıç noktası */}
                  <Marker position={routePath[0]}>
                    <Popup>
                      <div className="flex items-center gap-2">
                        <PlayIcon className="h-4 w-4 text-green-500" />
                        <span>Başlangıç</span>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Bitiş noktası */}
                  {routePath.length > 1 && (
                    <Marker position={routePath[routePath.length - 1]}>
                      <Popup>
                        <div className="flex items-center gap-2">
                          <StopIcon className="h-4 w-4 text-red-500" />
                          <span>Bitiş</span>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Duraklar */}
                  {tripStops.map((stop) => (
                    <CircleMarker
                      key={stop.id}
                      center={[stop.latitude, stop.longitude]}
                      radius={8}
                      fillColor={getStopColor(stop.location_type)}
                      color="white"
                      weight={2}
                      fillOpacity={0.8}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>
                            {stop.location_type === 'loading'
                              ? 'Yükleme'
                              : stop.location_type === 'unloading'
                              ? 'Boşaltma'
                              : stop.location_type === 'rest_area'
                              ? 'Dinlenme'
                              : stop.location_type === 'gas_station'
                              ? 'Benzinlik'
                              : 'Durak'}
                          </strong>
                          <br />
                          {stop.province}, {stop.district}
                          <br />
                          Süre: {stop.duration_minutes} dk
                          <br />
                          {new Date(stop.started_at).toLocaleTimeString('tr-TR')}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </>
              )}

              {/* Seçili sefer yoksa tüm seferleri göster */}
              {!selectedTrip &&
                routes
                  .filter((r) => r.start_latitude && r.end_latitude)
                  .map((route) => (
                    <Polyline
                      key={route.trip_id}
                      positions={[
                        [route.start_latitude, route.start_longitude],
                        [route.end_latitude, route.end_longitude],
                      ]}
                      color={route.status === 'completed' ? '#22c55e' : '#f97316'}
                      weight={2}
                      opacity={0.6}
                      eventHandlers={{
                        click: () => setSelectedTrip(route.trip_id),
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>
                            {route.start_province} → {route.end_province}
                          </strong>
                          <br />
                          {route.distance_km?.toFixed(1)} km
                          <br />
                          {new Date(route.started_at).toLocaleDateString('tr-TR')}
                        </div>
                      </Popup>
                    </Polyline>
                  ))}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Trip Details Panel */}
      {selectedTrip && tripStops.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Sefer Durakları</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tripStops.map((stop, idx) => (
              <div
                key={stop.id}
                className="border rounded-lg p-4"
                style={{ borderLeftColor: getStopColor(stop.location_type), borderLeftWidth: 4 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    #{idx + 1}{' '}
                    {stop.location_type === 'loading'
                      ? 'Yükleme'
                      : stop.location_type === 'unloading'
                      ? 'Boşaltma'
                      : stop.location_type === 'rest_area'
                      ? 'Dinlenme'
                      : stop.location_type === 'gas_station'
                      ? 'Benzinlik'
                      : 'Durak'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {stop.duration_minutes} dk
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {stop.province}, {stop.district}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(stop.started_at).toLocaleTimeString('tr-TR')}
                  {stop.ended_at &&
                    ` - ${new Date(stop.ended_at).toLocaleTimeString('tr-TR')}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-medium mb-3">Durak Tipleri</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Yükleme</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Boşaltma</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Dinlenme</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>Benzinlik</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Park</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Diğer</span>
          </div>
        </div>
      </div>
    </div>
  )
}
