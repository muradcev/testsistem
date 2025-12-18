import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { locationsApi, driversApi } from '../services/api'
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet'
import { FireIcon, MapPinIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import 'leaflet/dist/leaflet.css'

interface LocationPoint {
  latitude: number
  longitude: number
  driver_id: string
  driver_name?: string
  updated_at: string
  speed?: number
  current_status?: string
}

interface HeatPoint {
  lat: number
  lng: number
  count: number
  drivers: string[]
  lastSeen: string
}

// Grid boyutu (derece cinsinden, yaklaşık 1km)
const GRID_SIZE = 0.01

function calculateHeatPoints(locations: LocationPoint[]): HeatPoint[] {
  const grid: Record<string, HeatPoint> = {}

  locations.forEach((loc) => {
    // Grid hücresini hesapla
    const gridLat = Math.floor(loc.latitude / GRID_SIZE) * GRID_SIZE
    const gridLng = Math.floor(loc.longitude / GRID_SIZE) * GRID_SIZE
    const key = `${gridLat.toFixed(4)}_${gridLng.toFixed(4)}`

    const locTime = loc.updated_at || ''

    if (!grid[key]) {
      grid[key] = {
        lat: gridLat + GRID_SIZE / 2,
        lng: gridLng + GRID_SIZE / 2,
        count: 0,
        drivers: [],
        lastSeen: locTime,
      }
    }

    grid[key].count++
    if (!grid[key].drivers.includes(loc.driver_id)) {
      grid[key].drivers.push(loc.driver_id)
    }

    // Tarih karşılaştırması güvenli şekilde
    const currentLastSeen = new Date(grid[key].lastSeen)
    const newTime = new Date(locTime)
    if (locTime && !isNaN(newTime.getTime()) && newTime > currentLastSeen) {
      grid[key].lastSeen = locTime
    }
  })

  return Object.values(grid)
}

// Güvenli tarih formatla
function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleString('tr-TR')
}

function getHeatColor(count: number, maxCount: number): string {
  const ratio = count / maxCount
  if (ratio > 0.8) return '#ef4444' // Kırmızı - çok yoğun
  if (ratio > 0.6) return '#f97316' // Turuncu - yoğun
  if (ratio > 0.4) return '#eab308' // Sarı - orta
  if (ratio > 0.2) return '#22c55e' // Yeşil - az
  return '#3b82f6' // Mavi - çok az
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap()

  useMemo(() => {
    map.setView(center, map.getZoom())
  }, [center, map])

  return null
}

export default function HeatMapPage() {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h')
  const [center] = useState<[number, number]>([39.0, 35.0]) // Türkiye merkezi

  // Canlı konumları getir
  const { data: liveData } = useQuery({
    queryKey: ['live-locations'],
    queryFn: () => locationsApi.getLive(),
    refetchInterval: 30000, // 30 saniyede bir güncelle
  })

  // Tüm sürücüleri getir (isim eşleştirmesi için)
  const { data: driversData } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => driversApi.getAll({ limit: 1000 }),
  })

  const liveLocations: LocationPoint[] = liveData?.data?.locations || []
  const drivers = driversData?.data?.drivers || []

  // Sürücü isimlerini eşleştir
  const locationsWithNames = useMemo(() => {
    const driverMap: Record<string, string> = {}
    drivers.forEach((d: any) => {
      driverMap[d.id] = `${d.name} ${d.surname}`
    })

    return liveLocations.map((loc) => ({
      ...loc,
      driver_name: driverMap[loc.driver_id] || 'Bilinmiyor',
    }))
  }, [liveLocations, drivers])

  // Isı noktalarını hesapla
  const heatPoints = useMemo(() => {
    return calculateHeatPoints(locationsWithNames)
  }, [locationsWithNames])

  const maxCount = useMemo(() => {
    return Math.max(...heatPoints.map((p) => p.count), 1)
  }, [heatPoints])

  // İstatistikler
  const stats = useMemo(() => {
    const uniqueDrivers = new Set(liveLocations.map((l) => l.driver_id))
    const totalPoints = heatPoints.length
    const highDensityPoints = heatPoints.filter((p) => p.count / maxCount > 0.6).length

    return {
      activeDrivers: uniqueDrivers.size,
      totalZones: totalPoints,
      hotZones: highDensityPoints,
      totalLocations: liveLocations.length,
    }
  }, [liveLocations, heatPoints, maxCount])

  // Şoför bazlı konum dağılımı
  interface DriverLocationStats {
    driver_id: string
    driver_name: string
    current_status: string
    locations: { lat: number; lng: number; count: number; percentage: number }[]
    totalPoints: number
    topLocation: { lat: number; lng: number; percentage: number } | null
  }

  const driverLocationStats = useMemo(() => {
    const driverStats: Record<string, DriverLocationStats> = {}

    // Her sürücü için konum sayısını hesapla
    locationsWithNames.forEach((loc) => {
      if (!driverStats[loc.driver_id]) {
        driverStats[loc.driver_id] = {
          driver_id: loc.driver_id,
          driver_name: loc.driver_name || 'Bilinmiyor',
          current_status: loc.current_status || 'unknown',
          locations: [],
          totalPoints: 0,
          topLocation: null,
        }
      }
      driverStats[loc.driver_id].totalPoints++
    })

    // Her sürücü için bölge bazlı dağılımı hesapla
    Object.keys(driverStats).forEach((driverId) => {
      const driverLocs = locationsWithNames.filter((l) => l.driver_id === driverId)
      const locationGrid: Record<string, number> = {}

      driverLocs.forEach((loc) => {
        const gridLat = Math.floor(loc.latitude / GRID_SIZE) * GRID_SIZE
        const gridLng = Math.floor(loc.longitude / GRID_SIZE) * GRID_SIZE
        const key = `${gridLat.toFixed(4)}_${gridLng.toFixed(4)}`

        if (!locationGrid[key]) {
          locationGrid[key] = 0
        }
        locationGrid[key]++
      })

      // En çok bulunduğu lokasyonları hesapla
      const totalDriverPoints = driverStats[driverId].totalPoints
      const locations = Object.entries(locationGrid)
        .map(([key, count]) => {
          const [lat, lng] = key.split('_').map(Number)
          return {
            lat: lat + GRID_SIZE / 2,
            lng: lng + GRID_SIZE / 2,
            count,
            percentage: Math.round((count / totalDriverPoints) * 100),
          }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // En çok 5 lokasyon

      driverStats[driverId].locations = locations
      driverStats[driverId].topLocation = locations[0] || null
    })

    return Object.values(driverStats).sort((a, b) => b.totalPoints - a.totalPoints)
  }, [locationsWithNames])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FireIcon className="h-6 w-6 sm:h-7 sm:w-7 text-orange-500" />
            Isı Haritası
          </h1>
          <p className="text-sm sm:text-base text-gray-500">Konum yoğunluk analizi</p>
        </div>

        {/* Time Range Filter */}
        <div className="flex flex-wrap gap-2">
          {(['1h', '6h', '24h', '7d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range === '1h' && '1 Saat'}
              {range === '6h' && '6 Saat'}
              {range === '24h' && '24 Saat'}
              {range === '7d' && '7 Gün'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserGroupIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Aktif Sürücü</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeDrivers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPinIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Bölge</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalZones}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FireIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Yoğun Bölge</p>
              <p className="text-2xl font-bold text-gray-900">{stats.hotZones}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ClockIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Konum Kaydı</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalLocations}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="h-[350px] sm:h-[500px] lg:h-[600px] rounded-lg overflow-hidden">
          <MapContainer
            center={center}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController center={center} />

            {/* Heat Points */}
            {heatPoints.map((point, index) => (
              <Circle
                key={index}
                center={[point.lat, point.lng]}
                radius={Math.max(500, point.count * 100)} // En az 500m, yoğunluğa göre artır
                pathOptions={{
                  color: getHeatColor(point.count, maxCount),
                  fillColor: getHeatColor(point.count, maxCount),
                  fillOpacity: 0.4,
                  weight: 1,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Bölge Bilgisi</p>
                    <p>
                      <strong>Konum Sayısı:</strong> {point.count}
                    </p>
                    <p>
                      <strong>Sürücü Sayısı:</strong> {point.drivers.length}
                    </p>
                    <p>
                      <strong>Son Görülme:</strong>{' '}
                      {formatDate(point.lastSeen)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Circle>
            ))}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-6">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-blue-500"></div>
            <span className="text-xs sm:text-sm text-gray-600">Çok Az</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-500"></div>
            <span className="text-xs sm:text-sm text-gray-600">Az</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-yellow-500"></div>
            <span className="text-xs sm:text-sm text-gray-600">Orta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-orange-500"></div>
            <span className="text-xs sm:text-sm text-gray-600">Yoğun</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-red-500"></div>
            <span className="text-xs sm:text-sm text-gray-600">Çok Yoğun</span>
          </div>
        </div>
      </div>

      {/* Top Locations Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">En Yoğun Bölgeler</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Sıra
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Koordinat
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Konum Sayısı
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Sürücü Sayısı
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Son Görülme
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Yoğunluk
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {heatPoints
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
                .map((point, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      #{index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{point.count}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {point.drivers.length}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(point.lastSeen)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getHeatColor(point.count, maxCount) }}
                        ></div>
                        <span className="text-sm">
                          {((point.count / maxCount) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Şoför Bazlı Konum Dağılımı */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserGroupIcon className="h-5 w-5 text-blue-600" />
          Şoför Bazlı Konum Dağılımı
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Her şoförün hangi bölgelerde ne kadar süre bulunduğu
        </p>

        {driverLocationStats.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Henüz konum verisi yok</p>
        ) : (
          <div className="space-y-4">
            {driverLocationStats.map((driver) => (
              <div key={driver.driver_id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-semibold">
                        {driver.driver_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{driver.driver_name}</p>
                      <p className="text-sm text-gray-500">
                        {driver.totalPoints} konum kaydı •{' '}
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs ${
                            driver.current_status === 'on_trip'
                              ? 'bg-green-100 text-green-700'
                              : driver.current_status === 'at_home'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {driver.current_status === 'on_trip'
                            ? 'Seferde'
                            : driver.current_status === 'at_home'
                            ? 'Evde'
                            : driver.current_status === 'stopped'
                            ? 'Durağan'
                            : 'Bilinmiyor'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Konum dağılım çubukları */}
                <div className="space-y-2">
                  {driver.locations.map((loc, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-32 text-xs text-gray-500 truncate">
                        📍 {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                      </div>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            idx === 0
                              ? 'bg-primary-500'
                              : idx === 1
                              ? 'bg-primary-400'
                              : idx === 2
                              ? 'bg-primary-300'
                              : 'bg-primary-200'
                          }`}
                          style={{ width: `${loc.percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm font-medium text-gray-700">
                        {loc.percentage}%
                      </div>
                    </div>
                  ))}
                </div>

                {driver.locations.length === 0 && (
                  <p className="text-sm text-gray-400 italic">Konum verisi yetersiz</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
