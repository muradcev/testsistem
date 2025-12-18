import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet'
import {
  MapPinIcon,
  HomeIcon,
  TruckIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api, { driverHomesApi, driversApi, locationsApi } from '../services/api'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

// Fix for default marker icon
try {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  })
} catch (e) {
  console.warn('Leaflet icon fix failed:', e)
}

// Custom icons
const homeIcon = L.divIcon({
  html: '<div style="font-size: 24px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));">🏠</div>',
  className: 'custom-home-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

const stopIcon = (type: string) => L.divIcon({
  html: `<div style="font-size: 20px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));">${locationTypeIcons[type] || '📍'}</div>`,
  className: 'custom-stop-icon',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

const driverIcon = (color: string = '#3b82f6') => L.divIcon({
  html: `<div style="
    background: ${color};
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  "></div>`,
  className: 'driver-location-icon',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

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

const DRIVER_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

interface Stop {
  id: string
  driver_id: string
  driver_name: string
  name?: string
  latitude: number
  longitude: number
  location_type: string
  location_label: string
  province?: string
  district?: string
  started_at: string
  duration_minutes: number
}

interface DriverHome {
  id: string
  driver_id: string
  driver_name?: string
  name: string
  latitude: number
  longitude: number
  province?: string
  district?: string
  radius: number
  is_active: boolean
}

interface Driver {
  id: string
  name: string
  surname: string
  phone: string
  last_latitude?: number
  last_longitude?: number
  last_location_at?: string
}

interface Location {
  latitude: number
  longitude: number
  recorded_at: string
  speed?: number
}

// Map controller for flying to location
function MapController({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 0.5 })
    }
  }, [center, zoom, map])
  return null
}

export default function MapViewPage() {
  // UI State
  const [showFilters, setShowFilters] = useState(true)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [mapZoom, setMapZoom] = useState(6)

  // Layer toggles
  const [showStops, setShowStops] = useState(true)
  const [showHomes, setShowHomes] = useState(true)
  const [showRoutes, setShowRoutes] = useState(false)
  const [showLiveLocations, setShowLiveLocations] = useState(false)

  // Filters
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])
  const [selectedStopTypes, setSelectedStopTypes] = useState<string[]>([])
  const [routeDate, setRouteDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // Fetch data
  const { data: driversData } = useQuery({
    queryKey: ['all-drivers'],
    queryFn: () => driversApi.getAll({ limit: 500 }),
  })
  const drivers: Driver[] = driversData?.data?.drivers || []

  const { data: homesData } = useQuery({
    queryKey: ['all-homes'],
    queryFn: () => driverHomesApi.getAll({ limit: 500 }),
    enabled: showHomes,
  })
  const homes: DriverHome[] = homesData?.data?.homes || []

  const { data: stopsData } = useQuery({
    queryKey: ['all-stops'],
    queryFn: () => api.get('/admin/stops?limit=1000'),
    enabled: showStops,
  })
  const stops: Stop[] = stopsData?.data?.stops || []

  const { data: typesData } = useQuery({
    queryKey: ['location-types'],
    queryFn: () => api.get('/admin/stops/location-types'),
  })
  const locationTypes = typesData?.data?.location_types || []

  const { data: liveData } = useQuery({
    queryKey: ['live-locations'],
    queryFn: () => locationsApi.getLive(),
    enabled: showLiveLocations,
    refetchInterval: showLiveLocations ? 10000 : false,
  })
  const liveLocations = liveData?.data?.locations || []

  // Fetch route data for selected drivers
  const { data: routesData } = useQuery({
    queryKey: ['driver-routes', selectedDrivers, routeDate],
    queryFn: async () => {
      if (selectedDrivers.length === 0) return { routes: {} }
      const routes: Record<string, Location[]> = {}
      for (const driverId of selectedDrivers.slice(0, 5)) { // Limit to 5 drivers
        try {
          const res = await api.get(`/admin/drivers/${driverId}/locations?limit=500&start_date=${routeDate}&end_date=${routeDate}`)
          routes[driverId] = res.data?.locations || []
        } catch (e) {
          routes[driverId] = []
        }
      }
      return { routes }
    },
    enabled: showRoutes && selectedDrivers.length > 0,
  })
  const driverRoutes = routesData?.routes || {}

  // Filtered data
  const filteredStops = useMemo(() => {
    let result = stops.filter(s => s.latitude != null && s.longitude != null)
    if (selectedDrivers.length > 0) {
      result = result.filter(s => selectedDrivers.includes(s.driver_id))
    }
    if (selectedStopTypes.length > 0) {
      result = result.filter(s => selectedStopTypes.includes(s.location_type))
    }
    return result
  }, [stops, selectedDrivers, selectedStopTypes])

  const filteredHomes = useMemo(() => {
    let result = homes.filter(h => h.latitude != null && h.longitude != null)
    if (selectedDrivers.length > 0) {
      result = result.filter(h => selectedDrivers.includes(h.driver_id))
    }
    return result
  }, [homes, selectedDrivers])

  const filteredLiveLocations = useMemo(() => {
    let result = liveLocations.filter((l: any) => l.latitude != null && l.longitude != null)
    if (selectedDrivers.length > 0) {
      result = result.filter((l: any) => selectedDrivers.includes(l.driver_id))
    }
    return result
  }, [liveLocations, selectedDrivers])

  // Driver color mapping
  const driverColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    selectedDrivers.forEach((id, i) => {
      map[id] = DRIVER_COLORS[i % DRIVER_COLORS.length]
    })
    return map
  }, [selectedDrivers])

  // Toggle driver selection
  const toggleDriver = (driverId: string) => {
    setSelectedDrivers(prev =>
      prev.includes(driverId)
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    )
  }

  // Toggle stop type
  const toggleStopType = (type: string) => {
    setSelectedStopTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  // Select all / clear
  const selectAllDrivers = () => setSelectedDrivers(drivers.map(d => d.id))
  const clearDrivers = () => setSelectedDrivers([])
  const selectAllStopTypes = () => setSelectedStopTypes(locationTypes.map((t: any) => t.value))
  const clearStopTypes = () => setSelectedStopTypes([])

  // Fly to location
  const flyTo = (lat: number, lng: number, zoom: number = 14) => {
    setMapCenter([lat, lng])
    setMapZoom(zoom)
  }

  // Stats
  const stats = {
    stops: filteredStops.length,
    homes: filteredHomes.length,
    drivers: selectedDrivers.length,
    live: filteredLiveLocations.length,
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col sm:flex-row gap-4">
      {/* Filters Panel */}
      <div className={`${showFilters ? 'w-full sm:w-80' : 'w-0'} transition-all duration-300 overflow-hidden flex-shrink-0`}>
        {showFilters && (
          <div className="bg-white rounded-lg shadow h-full flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="h-5 w-5" />
                Filtreler
              </h2>
              <button
                onClick={() => setShowFilters(false)}
                className="sm:hidden p-1 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Layer Toggles */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Katmanlar</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showStops}
                      onChange={(e) => setShowStops(e.target.checked)}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <MapPinIcon className="h-5 w-5 text-blue-500" />
                    <span className="text-sm">Duraklar</span>
                    <span className="text-xs text-gray-400 ml-auto">{stats.stops}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHomes}
                      onChange={(e) => setShowHomes(e.target.checked)}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <HomeIcon className="h-5 w-5 text-green-500" />
                    <span className="text-sm">Ev Adresleri</span>
                    <span className="text-xs text-gray-400 ml-auto">{stats.homes}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRoutes}
                      onChange={(e) => setShowRoutes(e.target.checked)}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <TruckIcon className="h-5 w-5 text-orange-500" />
                    <span className="text-sm">Güzergahlar</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLiveLocations}
                      onChange={(e) => setShowLiveLocations(e.target.checked)}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                    <div className="h-5 w-5 flex items-center justify-center">
                      <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                    </div>
                    <span className="text-sm">Canlı Konumlar</span>
                    <span className="text-xs text-gray-400 ml-auto">{stats.live}</span>
                  </label>
                </div>
              </div>

              {/* Route Date */}
              {showRoutes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Güzergah Tarihi</h3>
                  <input
                    type="date"
                    value={routeDate}
                    onChange={(e) => setRouteDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}

              {/* Stop Types */}
              {showStops && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Durak Tipleri</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllStopTypes}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Tümü
                      </button>
                      <button
                        onClick={clearStopTypes}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Temizle
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {locationTypes.map((type: any) => (
                      <label
                        key={type.value}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border text-sm ${
                          selectedStopTypes.includes(type.value)
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStopTypes.includes(type.value)}
                          onChange={() => toggleStopType(type.value)}
                          className="sr-only"
                        />
                        <span>{locationTypeIcons[type.value] || '📍'}</span>
                        <span className="truncate">{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Driver Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Şoförler ({stats.drivers})</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllDrivers}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Tümü
                    </button>
                    <button
                      onClick={clearDrivers}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Temizle
                    </button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                  {drivers.map((driver) => (
                    <label
                      key={driver.id}
                      className={`flex items-center gap-2 p-2 cursor-pointer ${
                        selectedDrivers.includes(driver.id) ? 'bg-primary-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDrivers.includes(driver.id)}
                        onChange={() => toggleDriver(driver.id)}
                        className="h-4 w-4 text-primary-600 rounded"
                      />
                      {selectedDrivers.includes(driver.id) && (
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: driverColorMap[driver.id] }}
                        />
                      )}
                      <span className="text-sm truncate">
                        {driver.name} {driver.surname}
                      </span>
                      {driver.last_location_at && (
                        <span className="text-xs text-gray-400 ml-auto">
                          {format(new Date(driver.last_location_at), 'HH:mm', { locale: tr })}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 bg-white rounded-lg shadow overflow-hidden relative">
        {/* Toggle filters button */}
        {!showFilters && (
          <button
            onClick={() => setShowFilters(true)}
            className="absolute top-4 left-4 z-[1000] bg-white shadow-lg rounded-lg p-2 hover:bg-gray-50"
          >
            <FunnelIcon className="h-5 w-5 text-gray-600" />
          </button>
        )}

        {/* Stats Bar */}
        <div className="absolute top-4 right-4 z-[1000] flex gap-2">
          {showStops && stats.stops > 0 && (
            <div className="bg-white shadow rounded-lg px-3 py-1.5 text-sm flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 text-blue-500" />
              <span>{stats.stops} durak</span>
            </div>
          )}
          {showHomes && stats.homes > 0 && (
            <div className="bg-white shadow rounded-lg px-3 py-1.5 text-sm flex items-center gap-2">
              <HomeIcon className="h-4 w-4 text-green-500" />
              <span>{stats.homes} ev</span>
            </div>
          )}
          {showLiveLocations && stats.live > 0 && (
            <div className="bg-white shadow rounded-lg px-3 py-1.5 text-sm flex items-center gap-2">
              <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              <span>{stats.live} canlı</span>
            </div>
          )}
        </div>

        {/* Map */}
        <MapContainer
          center={[39.0, 35.0]}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController center={mapCenter} zoom={mapZoom} />

          {/* Stops */}
          {showStops && filteredStops.map((stop) => (
            <Marker
              key={stop.id}
              position={[stop.latitude, stop.longitude]}
              icon={stopIcon(stop.location_type)}
            >
              <Popup>
                <div className="text-sm min-w-[180px]">
                  <p className="font-semibold flex items-center gap-2">
                    <TruckIcon className="h-4 w-4" />
                    {stop.driver_name}
                  </p>
                  {stop.name && <p className="text-primary-600 font-medium">{stop.name}</p>}
                  <p className="text-gray-600">
                    {locationTypeIcons[stop.location_type]} {stop.location_label || 'Bilinmiyor'}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {stop.province}, {stop.district}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {stop.duration_minutes ? `${Math.round(stop.duration_minutes)} dk` : '-'}
                  </p>
                  <button
                    onClick={() => flyTo(stop.latitude, stop.longitude, 16)}
                    className="mt-2 text-xs text-primary-600 hover:underline"
                  >
                    Yakınlaştır
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Homes */}
          {showHomes && filteredHomes.map((home) => (
            <div key={home.id}>
              <Marker
                position={[home.latitude, home.longitude]}
                icon={homeIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{home.driver_name || 'Şoför'}</p>
                    <p className="text-green-600">{home.name}</p>
                    <p className="text-gray-500 text-xs">
                      {home.province}, {home.district}
                    </p>
                    <p className="text-gray-400 text-xs">Yarıçap: {home.radius}m</p>
                    <button
                      onClick={() => flyTo(home.latitude, home.longitude, 16)}
                      className="mt-2 text-xs text-primary-600 hover:underline"
                    >
                      Yakınlaştır
                    </button>
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={[home.latitude, home.longitude]}
                radius={home.radius}
                pathOptions={{
                  color: home.is_active ? '#22c55e' : '#9ca3af',
                  fillColor: home.is_active ? '#22c55e' : '#9ca3af',
                  fillOpacity: 0.15,
                }}
              />
            </div>
          ))}

          {/* Routes */}
          {showRoutes && Object.entries(driverRoutes).map(([driverId, locations]) => {
            if (!locations || locations.length < 2) return null
            const color = driverColorMap[driverId] || '#3b82f6'
            const positions = locations
              .filter((l: Location) => l.latitude && l.longitude)
              .map((l: Location) => [l.latitude, l.longitude] as [number, number])

            if (positions.length < 2) return null

            const driver = drivers.find(d => d.id === driverId)
            return (
              <div key={driverId}>
                <Polyline
                  positions={positions}
                  pathOptions={{
                    color,
                    weight: 3,
                    opacity: 0.7,
                  }}
                />
                {/* Start marker */}
                <Circle
                  center={positions[0]}
                  radius={50}
                  pathOptions={{
                    color: '#22c55e',
                    fillColor: '#22c55e',
                    fillOpacity: 0.8,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{driver?.name} {driver?.surname}</p>
                      <p className="text-green-600">Başlangıç</p>
                      <p className="text-gray-400 text-xs">
                        {locations[0]?.recorded_at ? format(new Date(locations[0].recorded_at), 'HH:mm', { locale: tr }) : '-'}
                      </p>
                    </div>
                  </Popup>
                </Circle>
                {/* End marker */}
                <Circle
                  center={positions[positions.length - 1]}
                  radius={50}
                  pathOptions={{
                    color: '#ef4444',
                    fillColor: '#ef4444',
                    fillOpacity: 0.8,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{driver?.name} {driver?.surname}</p>
                      <p className="text-red-600">Bitiş</p>
                      <p className="text-gray-400 text-xs">
                        {locations[locations.length - 1]?.recorded_at
                          ? format(new Date(locations[locations.length - 1].recorded_at), 'HH:mm', { locale: tr })
                          : '-'}
                      </p>
                    </div>
                  </Popup>
                </Circle>
              </div>
            )
          })}

          {/* Live Locations */}
          {showLiveLocations && filteredLiveLocations.map((loc: any) => {
            const color = selectedDrivers.includes(loc.driver_id)
              ? driverColorMap[loc.driver_id]
              : '#ef4444'
            return (
              <Marker
                key={loc.driver_id}
                position={[loc.latitude, loc.longitude]}
                icon={driverIcon(color)}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{loc.driver_name} {loc.driver_surname}</p>
                    <p className="text-gray-600">
                      {loc.speed ? `${Math.round(loc.speed)} km/s` : 'Duruyor'}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {loc.updated_at ? format(new Date(loc.updated_at), 'HH:mm:ss', { locale: tr }) : '-'}
                    </p>
                    <button
                      onClick={() => flyTo(loc.latitude, loc.longitude, 16)}
                      className="mt-2 text-xs text-primary-600 hover:underline"
                    >
                      Yakınlaştır
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
