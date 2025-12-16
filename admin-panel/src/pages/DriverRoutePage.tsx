import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet'
import {
  ArrowLeftIcon,
  PlayIcon,
  PauseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  TruckIcon,
  CalendarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { format, subDays, differenceInMinutes, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { driversApi } from '../services/api'

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

interface Location {
  id: string
  latitude: number
  longitude: number
  recorded_at: string
  speed: number
  accuracy: number
  battery_level: number
  activity_type: string
}

interface Stop {
  startIndex: number
  endIndex: number
  startTime: string
  endTime: string
  latitude: number
  longitude: number
  durationMinutes: number
}

interface RouteStats {
  totalDistance: number
  totalDuration: number
  totalStops: number
  avgSpeed: number
  maxSpeed: number
}

// Calculate distance between two points in km (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Calculate distance in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateDistance(lat1, lon1, lat2, lon2) * 1000
}

// Group nearby locations within radius (default 100m) for cleaner map display
function simplifyLocations(locations: Location[], radiusMeters: number = 100): Location[] {
  if (locations.length < 2) return locations

  const simplified: Location[] = [locations[0]]

  for (let i = 1; i < locations.length; i++) {
    const last = simplified[simplified.length - 1]
    const current = locations[i]
    const distance = calculateDistanceMeters(last.latitude, last.longitude, current.latitude, current.longitude)

    // Keep point if distance > radius OR significant speed change OR significant time gap
    const timeDiff = Math.abs(new Date(current.recorded_at).getTime() - new Date(last.recorded_at).getTime()) / 1000
    const speedChange = Math.abs((current.speed || 0) - (last.speed || 0))

    if (distance > radiusMeters || speedChange > 10 || timeDiff > 300) {
      simplified.push(current)
    }
  }

  // Always include last point
  if (simplified[simplified.length - 1] !== locations[locations.length - 1]) {
    simplified.push(locations[locations.length - 1])
  }

  return simplified
}

// Detect stops from location data
function detectStops(locations: Location[], minDurationMinutes: number = 5, maxDistanceMeters: number = 50): Stop[] {
  if (locations.length < 2) return []

  const stops: Stop[] = []
  let stopStartIndex = 0
  let stopStartTime = locations[0].recorded_at
  let avgLat = locations[0].latitude
  let avgLon = locations[0].longitude
  let pointCount = 1

  for (let i = 1; i < locations.length; i++) {
    const loc = locations[i]
    const distanceFromCenter = calculateDistance(avgLat, avgLon, loc.latitude, loc.longitude) * 1000

    if (distanceFromCenter <= maxDistanceMeters) {
      // Still in stop zone
      avgLat = (avgLat * pointCount + loc.latitude) / (pointCount + 1)
      avgLon = (avgLon * pointCount + loc.longitude) / (pointCount + 1)
      pointCount++
    } else {
      // Moved out of stop zone
      const stopDuration = differenceInMinutes(parseISO(locations[i - 1].recorded_at), parseISO(stopStartTime))
      if (stopDuration >= minDurationMinutes) {
        stops.push({
          startIndex: stopStartIndex,
          endIndex: i - 1,
          startTime: stopStartTime,
          endTime: locations[i - 1].recorded_at,
          latitude: avgLat,
          longitude: avgLon,
          durationMinutes: stopDuration,
        })
      }
      // Reset for new potential stop
      stopStartIndex = i
      stopStartTime = loc.recorded_at
      avgLat = loc.latitude
      avgLon = loc.longitude
      pointCount = 1
    }
  }

  // Check final potential stop
  const lastStopDuration = differenceInMinutes(
    parseISO(locations[locations.length - 1].recorded_at),
    parseISO(stopStartTime)
  )
  if (lastStopDuration >= minDurationMinutes) {
    stops.push({
      startIndex: stopStartIndex,
      endIndex: locations.length - 1,
      startTime: stopStartTime,
      endTime: locations[locations.length - 1].recorded_at,
      latitude: avgLat,
      longitude: avgLon,
      durationMinutes: lastStopDuration,
    })
  }

  return stops
}

// Calculate route stats
function calculateStats(locations: Location[]): RouteStats {
  if (locations.length < 2)
    return { totalDistance: 0, totalDuration: 0, totalStops: 0, avgSpeed: 0, maxSpeed: 0 }

  let totalDistance = 0
  let maxSpeed = 0

  for (let i = 1; i < locations.length; i++) {
    totalDistance += calculateDistance(
      locations[i - 1].latitude,
      locations[i - 1].longitude,
      locations[i].latitude,
      locations[i].longitude
    )
    if (locations[i].speed > maxSpeed) {
      maxSpeed = locations[i].speed
    }
  }

  const totalDuration = differenceInMinutes(
    parseISO(locations[locations.length - 1].recorded_at),
    parseISO(locations[0].recorded_at)
  )

  const avgSpeed = totalDuration > 0 ? (totalDistance / totalDuration) * 60 : 0

  return {
    totalDistance,
    totalDuration,
    totalStops: 0, // Will be set separately
    avgSpeed,
    maxSpeed,
  }
}

// Map bounds fitter
function MapBoundsFitter({ locations }: { locations: Location[] }) {
  const map = useMap()

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map((loc) => [loc.latitude, loc.longitude]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [locations, map])

  return null
}

// Timeline position marker
function TimelineMarker({ position, locations }: { position: number; locations: Location[] }) {
  const map = useMap()
  const index = Math.min(Math.floor(position * (locations.length - 1)), locations.length - 1)

  useEffect(() => {
    if (locations.length > 0 && index >= 0) {
      const loc = locations[index]
      map.flyTo([loc.latitude, loc.longitude], map.getZoom(), { duration: 0.3 })
    }
  }, [index, locations, map])

  if (locations.length === 0 || index < 0) return null

  const loc = locations[index]
  return (
    <CircleMarker
      center={[loc.latitude, loc.longitude]}
      radius={12}
      pathOptions={{
        color: '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: 1,
        weight: 3,
      }}
    >
      <Popup>
        <div className="text-sm">
          <strong>Zaman:</strong> {format(parseISO(loc.recorded_at), 'dd MMM HH:mm:ss', { locale: tr })}
          <br />
          <strong>Hız:</strong> {Math.round(loc.speed)} km/s
          <br />
          <strong>Batarya:</strong> {loc.battery_level}%
        </div>
      </Popup>
    </CircleMarker>
  )
}

// Get color based on speed
function getSpeedColor(speed: number): string {
  if (speed < 20) return '#22c55e' // Green - slow/stopped
  if (speed < 60) return '#3b82f6' // Blue - city driving
  if (speed < 100) return '#f59e0b' // Orange - highway
  return '#ef4444' // Red - fast
}

// Date range options
const dateRanges = [
  { label: 'Son 1 Gün', days: 1 },
  { label: 'Son 3 Gün', days: 3 },
  { label: 'Son 5 Gün', days: 5 },
  { label: 'Son 7 Gün', days: 7 },
  { label: 'Son 14 Gün', days: 14 },
]

export default function DriverRoutePage() {
  const { id } = useParams<{ id: string }>()
  const [selectedRange, setSelectedRange] = useState(1) // Default: last 1 day
  const [timelinePosition, setTimelinePosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(1)
  const animationRef = useRef<number | null>(null)

  // Calculate date range
  const endDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const startDate = useMemo(() => format(subDays(new Date(), selectedRange), 'yyyy-MM-dd'), [selectedRange])

  // Fetch driver info
  const { data: driverData } = useQuery({
    queryKey: ['driver', id],
    queryFn: () => driversApi.getById(id!),
    enabled: !!id,
  })

  // Fetch locations
  const {
    data: locationsData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['driver-route', id, startDate, endDate],
    queryFn: () => driversApi.getLocations(id!, { start_date: startDate, end_date: endDate }),
    enabled: !!id,
    refetchOnWindowFocus: false,
  })

  const driver = driverData?.data?.driver

  // All locations for stats
  const allLocations: Location[] = useMemo(() => {
    const locs = locationsData?.data?.locations || []
    // Sort by recorded_at ascending for correct route drawing
    return [...locs].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
  }, [locationsData])

  // Simplified locations for map (group within 100m)
  const locations: Location[] = useMemo(() => {
    return simplifyLocations(allLocations, 100)
  }, [allLocations])

  // Detect stops (use all locations for accuracy)
  const stops = useMemo(() => detectStops(allLocations), [allLocations])

  // Calculate stats (use all locations)
  const stats = useMemo(() => {
    const baseStats = calculateStats(allLocations)
    return { ...baseStats, totalStops: stops.length }
  }, [allLocations, stops])

  // Create polyline segments with colors based on speed (use simplified for performance)
  const routeSegments = useMemo(() => {
    if (locations.length < 2) return []

    const segments: Array<{ positions: [number, number][]; color: string }> = []
    let currentSegment: [number, number][] = [[locations[0].latitude, locations[0].longitude]]
    let currentColor = getSpeedColor(locations[0].speed)

    for (let i = 1; i < locations.length; i++) {
      const newColor = getSpeedColor(locations[i].speed)
      if (newColor !== currentColor) {
        currentSegment.push([locations[i].latitude, locations[i].longitude])
        segments.push({ positions: currentSegment, color: currentColor })
        currentSegment = [[locations[i].latitude, locations[i].longitude]]
        currentColor = newColor
      } else {
        currentSegment.push([locations[i].latitude, locations[i].longitude])
      }
    }

    if (currentSegment.length > 1) {
      segments.push({ positions: currentSegment, color: currentColor })
    }

    return segments
  }, [locations])

  // Playback animation
  useEffect(() => {
    if (isPlaying && locations.length > 0) {
      const step = () => {
        setTimelinePosition((prev) => {
          const next = prev + 0.001 * playSpeed
          if (next >= 1) {
            setIsPlaying(false)
            return 1
          }
          return next
        })
        animationRef.current = requestAnimationFrame(step)
      }
      animationRef.current = requestAnimationFrame(step)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, playSpeed, locations.length])

  // Current time indicator - guard against empty locations array
  const currentTimeIndex = locations.length > 0
    ? Math.min(Math.floor(timelinePosition * (locations.length - 1)), locations.length - 1)
    : 0
  const currentTime = useMemo(() => {
    if (locations.length === 0 || currentTimeIndex < 0) return ''
    const location = locations[currentTimeIndex]
    if (!location?.recorded_at) return ''
    try {
      return format(parseISO(location.recorded_at), 'dd MMM HH:mm', { locale: tr })
    } catch {
      return ''
    }
  }, [locations, currentTimeIndex])

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} dk`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}s ${mins}dk`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/driver-locations"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {driver?.name} {driver?.surname} - Güzergah
            </h1>
            <p className="text-sm text-gray-500">{driver?.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            {dateRanges.map((range) => (
              <button
                key={range.days}
                onClick={() => {
                  setSelectedRange(range.days)
                  setTimelinePosition(0)
                }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  selectedRange === range.days
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 text-blue-500" />
              <span className="text-sm">
                <strong>{allLocations.length}</strong> konum
                {allLocations.length !== locations.length && (
                  <span className="text-gray-400 ml-1">({locations.length} haritada)</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TruckIcon className="h-4 w-4 text-green-500" />
              <span className="text-sm">
                <strong>{stats.totalDistance.toFixed(1)}</strong> km mesafe
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-orange-500" />
              <span className="text-sm">
                <strong>{formatDuration(stats.totalDuration)}</strong> süre
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 text-red-500" />
              <span className="text-sm">
                <strong>{stats.totalStops}</strong> durak
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                Ort. Hız: <strong>{stats.avgSpeed.toFixed(1)}</strong> km/s | Max:{' '}
                <strong>{Math.round(stats.maxSpeed)}</strong> km/s
              </span>
            </div>
          </div>

          {/* Speed Legend */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              &lt;20
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              20-60
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span>
              60-100
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              &gt;100 km/s
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {locations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MapPinIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700">Konum Verisi Yok</h2>
              <p className="text-gray-500 mt-2">Bu tarih aralığında konum verisi bulunamadı.</p>
              <p className="text-sm text-gray-400 mt-1">Farklı bir tarih aralığı seçin.</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={[locations[0].latitude, locations[0].longitude]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBoundsFitter locations={locations} />

            {/* Route segments with speed-based colors */}
            {routeSegments.map((segment, index) => (
              <Polyline
                key={index}
                positions={segment.positions}
                pathOptions={{
                  color: segment.color,
                  weight: 4,
                  opacity: 0.8,
                }}
              />
            ))}

            {/* Start marker */}
            <CircleMarker
              center={[locations[0].latitude, locations[0].longitude]}
              radius={10}
              pathOptions={{
                color: '#22c55e',
                fillColor: '#22c55e',
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong className="text-green-600">Başlangıç</strong>
                  <br />
                  {format(parseISO(locations[0].recorded_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                </div>
              </Popup>
            </CircleMarker>

            {/* End marker */}
            <CircleMarker
              center={[locations[locations.length - 1].latitude, locations[locations.length - 1].longitude]}
              radius={10}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong className="text-red-600">Bitiş</strong>
                  <br />
                  {format(parseISO(locations[locations.length - 1].recorded_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                </div>
              </Popup>
            </CircleMarker>

            {/* Stop markers */}
            {stops.map((stop, index) => (
              <CircleMarker
                key={index}
                center={[stop.latitude, stop.longitude]}
                radius={8}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#fef3c7',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong className="text-orange-600">Durak #{index + 1}</strong>
                    <br />
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      {formatDuration(stop.durationMinutes)}
                    </span>
                    <br />
                    <span className="text-xs text-gray-500">
                      {format(parseISO(stop.startTime), 'HH:mm', { locale: tr })} -{' '}
                      {format(parseISO(stop.endTime), 'HH:mm', { locale: tr })}
                    </span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Timeline position marker */}
            <TimelineMarker position={timelinePosition} locations={locations} />
          </MapContainer>
        )}
      </div>

      {/* Timeline Control Bar */}
      {locations.length > 0 && (
        <div className="bg-white border-t px-4 py-3">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
            </button>

            {/* Speed selector */}
            <select
              value={playSpeed}
              onChange={(e) => setPlaySpeed(Number(e.target.value))}
              className="border rounded-lg px-2 py-1 text-sm"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
              <option value={8}>8x</option>
            </select>

            {/* Step back */}
            <button
              onClick={() => setTimelinePosition(Math.max(0, timelinePosition - 0.01))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>

            {/* Timeline slider */}
            <div className="flex-1 flex items-center gap-3">
              <span className="text-sm text-gray-500 min-w-[100px]">
                {locations.length > 0 &&
                  format(parseISO(locations[0].recorded_at), 'dd MMM HH:mm', { locale: tr })}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={timelinePosition}
                onChange={(e) => setTimelinePosition(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <span className="text-sm text-gray-500 min-w-[100px] text-right">
                {locations.length > 0 &&
                  format(parseISO(locations[locations.length - 1].recorded_at), 'dd MMM HH:mm', { locale: tr })}
              </span>
            </div>

            {/* Step forward */}
            <button
              onClick={() => setTimelinePosition(Math.min(1, timelinePosition + 0.01))}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>

            {/* Current time display */}
            <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg min-w-[140px]">
              <CalendarIcon className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">{currentTime}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
