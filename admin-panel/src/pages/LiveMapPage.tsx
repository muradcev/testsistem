import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { locationsApi } from '../services/api'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Türkiye Bölgeleri ve İlleri
const turkeyRegions = {
  marmara: {
    name: 'Marmara',
    color: '#3B82F6',
    center: [40.7, 29.0] as [number, number],
    provinces: ['İstanbul', 'Kocaeli', 'Sakarya', 'Bursa', 'Balıkesir', 'Çanakkale', 'Edirne', 'Kırklareli', 'Tekirdağ', 'Yalova', 'Bilecik'],
  },
  ege: {
    name: 'Ege',
    color: '#10B981',
    center: [38.5, 28.0] as [number, number],
    provinces: ['İzmir', 'Aydın', 'Denizli', 'Muğla', 'Manisa', 'Kütahya', 'Uşak', 'Afyonkarahisar'],
  },
  akdeniz: {
    name: 'Akdeniz',
    color: '#F59E0B',
    center: [36.8, 32.5] as [number, number],
    provinces: ['Antalya', 'Adana', 'Mersin', 'Hatay', 'Kahramanmaraş', 'Osmaniye', 'Isparta', 'Burdur'],
  },
  icAnadolu: {
    name: 'İç Anadolu',
    color: '#EF4444',
    center: [39.0, 33.0] as [number, number],
    provinces: ['Ankara', 'Konya', 'Eskişehir', 'Kayseri', 'Sivas', 'Yozgat', 'Kırşehir', 'Nevşehir', 'Aksaray', 'Niğde', 'Karaman', 'Kırıkkale', 'Çankırı'],
  },
  karadeniz: {
    name: 'Karadeniz',
    color: '#8B5CF6',
    center: [41.0, 36.0] as [number, number],
    provinces: ['Samsun', 'Trabzon', 'Ordu', 'Giresun', 'Rize', 'Artvin', 'Gümüşhane', 'Bayburt', 'Tokat', 'Amasya', 'Çorum', 'Sinop', 'Kastamonu', 'Bartın', 'Karabük', 'Zonguldak', 'Düzce', 'Bolu'],
  },
  doguAnadolu: {
    name: 'Doğu Anadolu',
    color: '#EC4899',
    center: [39.5, 41.0] as [number, number],
    provinces: ['Erzurum', 'Van', 'Malatya', 'Elazığ', 'Erzincan', 'Muş', 'Bitlis', 'Bingöl', 'Tunceli', 'Ağrı', 'Kars', 'Iğdır', 'Ardahan', 'Hakkari'],
  },
  guneydoguAnadolu: {
    name: 'Güneydoğu Anadolu',
    color: '#06B6D4',
    center: [37.5, 39.5] as [number, number],
    provinces: ['Gaziantep', 'Şanlıurfa', 'Diyarbakır', 'Mardin', 'Batman', 'Siirt', 'Şırnak', 'Adıyaman', 'Kilis'],
  },
}

// Custom icons for different statuses
const createIcon = (color: string) =>
  new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

const statusIcons: Record<string, L.DivIcon> = {
  on_trip: createIcon('#f97316'), // orange
  at_home: createIcon('#3b82f6'), // blue
  active: createIcon('#22c55e'), // green
  inactive: createIcon('#6b7280'), // gray
}

interface LiveLocation {
  driver_id: string
  driver_name: string
  driver_surname: string
  latitude: number
  longitude: number
  speed: number
  status: string
  updated_at: string
  province?: string
}

function MapUpdater({ locations, selectedRegion }: { locations: LiveLocation[], selectedRegion: string | null }) {
  const map = useMap()
  const initialBoundsSet = useRef(false)

  useEffect(() => {
    if (selectedRegion && turkeyRegions[selectedRegion as keyof typeof turkeyRegions]) {
      const region = turkeyRegions[selectedRegion as keyof typeof turkeyRegions]
      map.flyTo(region.center, 7, { duration: 1 })
    } else if (locations.length > 0 && !initialBoundsSet.current) {
      const bounds = L.latLngBounds(
        locations.map((l) => [l.latitude, l.longitude])
      )
      map.fitBounds(bounds, { padding: [50, 50] })
      initialBoundsSet.current = true
    } else if (!selectedRegion) {
      map.flyTo([39.925533, 32.866287], 6, { duration: 1 })
    }
  }, [locations, map, selectedRegion])

  return null
}

export default function LiveMapPage() {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([])

  // Initial fetch
  const { data, isLoading } = useQuery({
    queryKey: ['live-locations'],
    queryFn: () => locationsApi.getLive(),
    refetchInterval: 10000, // Fallback: refresh every 10 seconds
  })

  // WebSocket connection for real-time updates
  useEffect(() => {
    // Backend WebSocket endpoint - Railway'de VITE_WS_URL kullanılır
    let wsUrl: string
    const wsEnvUrl = import.meta.env.VITE_WS_URL
    if (wsEnvUrl) {
      // VITE_WS_URL'e /ws path'ini ekle (eğer yoksa)
      const baseUrl = wsEnvUrl.endsWith('/ws') ? wsEnvUrl : `${wsEnvUrl}/ws`
      wsUrl = `${baseUrl}?type=admin&client_id=admin-panel-${Date.now()}`
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.hostname === 'localhost' ? 'localhost:8080' : window.location.host
      wsUrl = `${protocol}//${host}/ws?type=admin&client_id=admin-panel-${Date.now()}`
    }

    let ws: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout>
    let pingInterval: ReturnType<typeof setInterval>

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          setWsConnected(true)
          console.log('WebSocket connected')

          // Ping gönder (bağlantıyı canlı tut)
          pingInterval = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }))
            }
          }, 30000)
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)

            if (message.type === 'location_update') {
              // Backend'den gelen format: driver_id, name, latitude, longitude, speed, is_moving, status, timestamp
              const locationData: LiveLocation = {
                driver_id: message.driver_id,
                driver_name: message.name?.split(' ')[0] || '',
                driver_surname: message.name?.split(' ').slice(1).join(' ') || '',
                latitude: message.latitude,
                longitude: message.longitude,
                speed: message.speed || 0,
                status: message.status || 'active',
                updated_at: new Date(message.timestamp * 1000).toISOString(),
                province: message.province,
              }

              setLiveLocations((prev) => {
                const index = prev.findIndex((l) => l.driver_id === message.driver_id)
                if (index >= 0) {
                  const updated = [...prev]
                  updated[index] = locationData
                  return updated
                }
                return [...prev, locationData]
              })
            } else if (message.type === 'driver_status') {
              // Şoför durum değişikliği
              setLiveLocations((prev) =>
                prev.map((l) =>
                  l.driver_id === message.driver_id
                    ? { ...l, status: message.status }
                    : l
                )
              )
            }
          } catch (e) {
            console.error('WebSocket message parse error:', e)
          }
        }

        ws.onclose = () => {
          setWsConnected(false)
          clearInterval(pingInterval)
          console.log('WebSocket disconnected, reconnecting...')
          reconnectTimeout = setTimeout(connect, 5000)
        }

        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          ws?.close()
        }
      } catch (e) {
        console.error('WebSocket connection error:', e)
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout)
      clearInterval(pingInterval)
      ws?.close()
    }
  }, [])

  // Merge API data with WebSocket updates
  useEffect(() => {
    if (data?.data?.locations) {
      setLiveLocations((prev) => {
        const apiLocations = data.data.locations as LiveLocation[]
        const merged = [...apiLocations]

        // Keep WebSocket updates that are newer
        prev.forEach((wsLoc) => {
          const apiLoc = merged.find((l) => l.driver_id === wsLoc.driver_id)
          if (apiLoc) {
            if (new Date(wsLoc.updated_at) > new Date(apiLoc.updated_at)) {
              const idx = merged.findIndex((l) => l.driver_id === wsLoc.driver_id)
              merged[idx] = wsLoc
            }
          } else {
            merged.push(wsLoc)
          }
        })

        return merged
      })
    }
  }, [data])

  // Filter locations
  const filteredLocations = liveLocations.filter((l) => {
    // Status filter
    if (selectedStatus && l.status !== selectedStatus) return false

    // Region/Province filter
    if (selectedRegion) {
      const region = turkeyRegions[selectedRegion as keyof typeof turkeyRegions]
      if (region && l.province) {
        if (!region.provinces.includes(l.province)) return false
      }
    }

    if (selectedProvince && l.province !== selectedProvince) return false

    return true
  })

  const statusCounts = {
    on_trip: liveLocations.filter((l) => l.status === 'on_trip').length,
    at_home: liveLocations.filter((l) => l.status === 'at_home').length,
    active: liveLocations.filter((l) => l.status === 'active').length,
    total: liveLocations.length,
  }

  // Region counts
  const getRegionCount = (regionKey: string) => {
    const region = turkeyRegions[regionKey as keyof typeof turkeyRegions]
    return liveLocations.filter((l) => l.province && region.provinces.includes(l.province)).length
  }

  if (isLoading && liveLocations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Canlı Harita</h1>
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${
              wsConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-xs sm:text-sm text-gray-500">
            {wsConnected ? 'Canlı bağlantı aktif' : 'Bağlantı kuruluyor...'}
          </span>
        </div>
      </div>

      {/* Status filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
          <span className="text-xs sm:text-sm font-medium text-gray-700 w-full sm:w-auto">Durum:</span>
          <button
            onClick={() => setSelectedStatus(null)}
            className={`px-2 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              selectedStatus === null
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tümü ({statusCounts.total})
          </button>
          <button
            onClick={() => setSelectedStatus('on_trip')}
            className={`px-2 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              selectedStatus === 'on_trip'
                ? 'bg-orange-500 text-white'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            }`}
          >
            Seferde ({statusCounts.on_trip})
          </button>
          <button
            onClick={() => setSelectedStatus('at_home')}
            className={`px-2 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              selectedStatus === 'at_home'
                ? 'bg-blue-500 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            Evde ({statusCounts.at_home})
          </button>
          <button
            onClick={() => setSelectedStatus('active')}
            className={`px-2 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              selectedStatus === 'active'
                ? 'bg-green-500 text-white'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            Aktif ({statusCounts.active})
          </button>
        </div>

        {/* Region filters */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <span className="text-xs sm:text-sm font-medium text-gray-700 w-full sm:w-auto sm:mr-2">Bölge:</span>
          <button
            onClick={() => { setSelectedRegion(null); setSelectedProvince(null); }}
            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedRegion === null
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tüm Türkiye
          </button>
          {Object.entries(turkeyRegions).map(([key, region]) => (
            <button
              key={key}
              onClick={() => { setSelectedRegion(key); setSelectedProvince(null); }}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedRegion === key
                  ? 'text-white'
                  : 'text-gray-700 hover:opacity-80'
              }`}
              style={{
                backgroundColor: selectedRegion === key ? region.color : `${region.color}20`,
                color: selectedRegion === key ? 'white' : region.color,
              }}
            >
              {region.name} ({getRegionCount(key)})
            </button>
          ))}
        </div>

        {/* Province filter (when region selected) */}
        {selectedRegion && (
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t">
            <span className="text-xs sm:text-sm font-medium text-gray-700 w-full sm:w-auto sm:mr-2">İl:</span>
            <button
              onClick={() => setSelectedProvince(null)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                selectedProvince === null
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tümü
            </button>
            {turkeyRegions[selectedRegion as keyof typeof turkeyRegions]?.provinces.map((province) => {
              const count = liveLocations.filter((l) => l.province === province).length
              return (
                <button
                  key={province}
                  onClick={() => setSelectedProvince(province)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    selectedProvince === province
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {province} ({count})
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow overflow-hidden h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-340px)]">
        <MapContainer
          center={[39.925533, 32.866287]} // Turkey center
          zoom={6}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater locations={filteredLocations} selectedRegion={selectedRegion} />
          {filteredLocations.map((location) => (
            <Marker
              key={location.driver_id}
              position={[location.latitude, location.longitude]}
              icon={statusIcons[location.status] || statusIcons.inactive}
            >
              <Popup>
                <div className="min-w-48">
                  <h3 className="font-semibold">
                    {location.driver_name} {location.driver_surname}
                  </h3>
                  {location.province && (
                    <p className="text-sm text-gray-600">{location.province}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    Hız: {location.speed.toFixed(1)} km/s
                  </p>
                  <p className="text-sm text-gray-500">
                    Güncelleme:{' '}
                    {new Date(location.updated_at).toLocaleTimeString('tr-TR')}
                  </p>
                  <p className="text-sm">
                    Durum:{' '}
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        location.status === 'on_trip'
                          ? 'bg-orange-100 text-orange-800'
                          : location.status === 'at_home'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {location.status === 'on_trip'
                        ? 'Seferde'
                        : location.status === 'at_home'
                        ? 'Evde'
                        : 'Aktif'}
                    </span>
                  </p>
                  <Link
                    to={`/drivers/${location.driver_id}`}
                    className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block"
                  >
                    Detaya Git &rarr;
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Durum Açıklamaları</h3>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-6 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-orange-500 border-2 border-white shadow"></div>
              <span>Seferde</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-blue-500 border-2 border-white shadow"></div>
              <span>Evde</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-500 border-2 border-white shadow"></div>
              <span>Aktif</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-gray-500 border-2 border-white shadow"></div>
              <span>Pasif</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Bölge Dağılımı</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {Object.entries(turkeyRegions).map(([key, region]) => (
              <div key={key} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: region.color }}
                ></div>
                <span className="truncate">{region.name}: {getRegionCount(key)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
