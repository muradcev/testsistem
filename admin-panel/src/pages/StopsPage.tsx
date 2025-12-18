import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
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
  UserGroupIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api, { driverHomesApi } from '../services/api'

// Fix for default marker icon (with error handling)
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

// Custom home marker icon
const homeIcon = L.divIcon({
  html: '<div style="font-size: 24px;">🏠</div>',
  className: 'custom-home-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

// Create cluster icon
const createClusterIcon = (count: number, driverCount: number) => L.divIcon({
  html: `<div style="
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    border-radius: 50%;
    width: 45px;
    height: 45px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    border: 3px solid white;
  ">
    <span>${count}</span>
    <span style="font-size: 9px; opacity: 0.9;">👥${driverCount}</span>
  </div>`,
  className: 'custom-cluster-icon',
  iconSize: [45, 45],
  iconAnchor: [22, 22],
})

// Seçili durak için marker
const selectedIcon = L.divIcon({
  html: `<div style="
    background: #ef4444;
    color: white;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 10px rgba(239,68,68,0.5);
    border: 3px solid white;
    animation: pulse 1s infinite;
  ">📍</div>`,
  className: 'selected-marker-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

// Default marker icon (created once, not on every render)
const defaultStopIcon = new L.Icon.Default()

interface Stop {
  id: string
  driver_id: string
  driver_name: string
  name?: string
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

interface ClusteredStop {
  lat: number
  lng: number
  stops: Stop[]
  uniqueDrivers: string[]
  totalDuration: number
  province?: string
  district?: string
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

// Mesafe seçenekleri (derece cinsinden, yaklaşık metre karşılıkları)
const CLUSTER_DISTANCES = [
  { value: 0.001, label: '100m', meters: 100 },
  { value: 0.002, label: '200m', meters: 200 },
  { value: 0.0045, label: '500m', meters: 500 },
  { value: 0.009, label: '1km', meters: 1000 },
  { value: 0.018, label: '2km', meters: 2000 },
  { value: 0.045, label: '5km', meters: 5000 },
]

function clusterStops(stops: Stop[], gridSize: number = 0.0045): ClusteredStop[] {
  const grid: Record<string, ClusteredStop> = {}

  // Filter out stops with invalid coordinates
  const validStops = stops.filter(s =>
    s.latitude != null && s.longitude != null &&
    !isNaN(s.latitude) && !isNaN(s.longitude)
  )

  validStops.forEach((stop) => {
    const gridLat = Math.floor(stop.latitude / gridSize) * gridSize
    const gridLng = Math.floor(stop.longitude / gridSize) * gridSize
    const key = `${gridLat.toFixed(5)}_${gridLng.toFixed(5)}`

    if (!grid[key]) {
      grid[key] = {
        lat: gridLat + gridSize / 2,
        lng: gridLng + gridSize / 2,
        stops: [],
        uniqueDrivers: [],
        totalDuration: 0,
        province: stop.province,
        district: stop.district,
      }
    }

    grid[key].stops.push(stop)
    grid[key].totalDuration += stop.duration_minutes || 0
    if (stop.driver_id && !grid[key].uniqueDrivers.includes(stop.driver_id)) {
      grid[key].uniqueDrivers.push(stop.driver_id)
    }
  })

  return Object.values(grid).sort((a, b) => b.stops.length - a.stops.length)
}

// Harita kontrolcüsü - seçili konuma yakınlaşma
function MapController({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap()

  useEffect(() => {
    // Validate center coordinates before flying
    if (center && center[0] != null && center[1] != null &&
        !isNaN(center[0]) && !isNaN(center[1])) {
      try {
        map.flyTo(center, zoom, { duration: 0.5 })
      } catch (error) {
        console.warn('MapController flyTo error:', error)
      }
    }
  }, [center, zoom, map])

  return null
}

export default function StopsPage() {
  const queryClient = useQueryClient()
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<ClusteredStop | null>(null)
  const [filter, setFilter] = useState<'uncategorized' | 'all' | 'homes' | 'clusters'>('clusters')
  const [selectedType, setSelectedType] = useState<string>('')
  const [showHomeModal, setShowHomeModal] = useState(false)
  const [editingHome, setEditingHome] = useState<DriverHome | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const [mapZoom, setMapZoom] = useState(6)
  const [searchTerm, setSearchTerm] = useState('')
  const [homeForm, setHomeForm] = useState({
    name: '',
    radius: 500,
  })
  const [stopName, setStopName] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [showDetectModal, setShowDetectModal] = useState(false)
  const [clusterDistance, setClusterDistance] = useState(0.0045) // Default 500m

  // Get location types
  const { data: typesData, error: typesError } = useQuery({
    queryKey: ['location-types'],
    queryFn: () => api.get('/admin/stops/location-types'),
  })

  // Get stops
  const { data: stopsData, isLoading, error: stopsError } = useQuery({
    queryKey: ['stops', filter, selectedType],
    queryFn: () => {
      if (filter === 'uncategorized') {
        return api.get('/admin/stops/uncategorized?limit=500')
      }
      if (filter === 'homes') {
        return api.get('/admin/stops?location_type=home&limit=500')
      }
      const params = selectedType ? `?location_type=${selectedType}&limit=500` : '?limit=500'
      return api.get(`/admin/stops${params}`)
    },
    enabled: filter !== 'homes',
  })

  // Get all driver homes
  const { data: homesData, isLoading: homesLoading, error: homesError } = useQuery({
    queryKey: ['driver-homes'],
    queryFn: () => driverHomesApi.getAll({ limit: 100 }),
    enabled: filter === 'homes',
  })

  // Get all drivers for selection
  const { data: driversData } = useQuery({
    queryKey: ['drivers-for-stops'],
    queryFn: () => api.get('/admin/drivers?limit=500'),
  })
  const allDrivers = driversData?.data?.drivers || []

  // Log errors for debugging
  if (typesError) console.error('Types error:', typesError)
  if (stopsError) console.error('Stops error:', stopsError)
  if (homesError) console.error('Homes error:', homesError)

  // Update stop type and/or name mutation
  const updateMutation = useMutation({
    mutationFn: ({ stopId, locationType, name }: { stopId: string; locationType?: string; name?: string }) =>
      api.put(`/admin/stops/${stopId}`, { location_type: locationType, name }),
    onSuccess: () => {
      toast.success('Durak güncellendi')
      queryClient.invalidateQueries({ queryKey: ['stops'] })
      setSelectedStop(null)
      setStopName('')
    },
    onError: () => {
      toast.error('Güncelleme başarısız')
    },
  })

  // Detect stops mutation (all drivers)
  const detectMutation = useMutation({
    mutationFn: () => api.post('/admin/stops/detect-all'),
    onSuccess: (res) => {
      toast.success(`${res.data.detected_stops} yeni durak tespit edildi`)
      queryClient.invalidateQueries({ queryKey: ['stops'] })
      setShowDetectModal(false)
    },
    onError: () => {
      toast.error('Durak tespiti başarısız')
    },
  })

  // Detect stops for specific driver
  const detectForDriverMutation = useMutation({
    mutationFn: (driverId: string) => api.post(`/admin/stops/detect/${driverId}`),
    onSuccess: (res) => {
      toast.success(`${res.data.detected_stops} yeni durak tespit edildi`)
      queryClient.invalidateQueries({ queryKey: ['stops'] })
      setShowDetectModal(false)
      setSelectedDriverId('')
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
      setHomeForm({ name: '', radius: 500 })
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

  // Delete stop mutation
  const deleteStopMutation = useMutation({
    mutationFn: (stopId: string) => api.delete(`/admin/stops/${stopId}`),
    onSuccess: () => {
      toast.success('Durak silindi')
      queryClient.invalidateQueries({ queryKey: ['stops'] })
      setSelectedStop(null)
      setSelectedCluster(null)
    },
    onError: () => {
      toast.error('Durak silinemedi')
    },
  })

  // Bulk delete stops mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/admin/stops/bulk-delete', { ids }),
    onSuccess: (res) => {
      toast.success(`${res.data.deleted} durak silindi`)
      queryClient.invalidateQueries({ queryKey: ['stops'] })
      setSelectedCluster(null)
    },
    onError: () => {
      toast.error('Duraklar silinemedi')
    },
  })

  // Bulk update stop type mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, locationType }: { ids: string[]; locationType: string }) =>
      api.put('/admin/stops/bulk-update', { ids, location_type: locationType }),
    onSuccess: (res) => {
      toast.success(`${res.data.updated} durak güncellendi`)
      queryClient.invalidateQueries({ queryKey: ['stops'] })
    },
    onError: () => {
      toast.error('Duraklar güncellenemedi')
    },
  })

  const locationTypes: LocationType[] = typesData?.data?.location_types || []
  const stops: Stop[] = stopsData?.data?.stops || []
  const homes: DriverHome[] = homesData?.data?.homes || []
  const homesTotal = homesData?.data?.total || 0

  // Kümelenmiş duraklar
  const clusteredStops = useMemo(() => clusterStops(stops, clusterDistance), [stops, clusterDistance])

  // Filtrelenmiş kümeler (arama)
  const filteredClusters = useMemo(() => {
    if (!searchTerm) return clusteredStops
    const term = searchTerm.toLowerCase()
    return clusteredStops.filter(c =>
      c.province?.toLowerCase().includes(term) ||
      c.district?.toLowerCase().includes(term) ||
      c.stops.some(s => s.driver_name?.toLowerCase().includes(term))
    )
  }, [clusteredStops, searchTerm])

  // İstatistikler
  const stats = useMemo(() => {
    const uniqueDrivers = new Set(stops.map(s => s.driver_id))
    const totalDuration = stops.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
    const hotSpots = clusteredStops.filter(c => c.uniqueDrivers.length > 1).length

    return {
      totalStops: stops.length,
      uniqueDrivers: uniqueDrivers.size,
      clusters: clusteredStops.length,
      hotSpots,
      avgDuration: stops.length > 0 ? Math.round(totalDuration / stops.length) : 0,
    }
  }, [stops, clusteredStops])

  const formatDuration = (minutes: number | undefined | null) => {
    if (minutes == null || isNaN(minutes)) return '-'
    if (minutes < 60) return `${Math.round(minutes)} dk`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}s ${mins}dk`
  }

  const handleSetAsHome = () => {
    if (!selectedStop) return
    setHomeForm({
      name: `Ev`,
      radius: 500,
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

  // Haritada konuma git
  const flyToLocation = (lat: number, lng: number, zoom: number = 14) => {
    // Validate coordinates before setting
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      console.warn('Invalid coordinates for flyToLocation:', lat, lng)
      return
    }
    setMapCenter([lat, lng])
    setMapZoom(zoom)
  }

  // Durak seçildiğinde haritada göster
  const handleStopSelect = (stop: Stop) => {
    if (!stop) return
    setSelectedStop(stop)
    setSelectedCluster(null)
    setStopName(stop.name || '')
    // Only fly to location if coordinates are valid
    if (stop.latitude != null && stop.longitude != null &&
        !isNaN(stop.latitude) && !isNaN(stop.longitude)) {
      flyToLocation(stop.latitude, stop.longitude, 15)
    }
  }

  // Küme seçildiğinde haritada göster
  const handleClusterSelect = (cluster: ClusteredStop) => {
    if (!cluster) return
    setSelectedCluster(cluster)
    setSelectedStop(null)
    // Only fly to location if coordinates are valid
    if (cluster.lat != null && cluster.lng != null &&
        !isNaN(cluster.lat) && !isNaN(cluster.lng)) {
      flyToLocation(cluster.lat, cluster.lng, 14)
    }
  }

  // Ev seçildiğinde haritada göster
  const handleHomeSelect = (home: DriverHome) => {
    if (!home) return
    // Only fly to location if coordinates are valid
    if (home.latitude != null && home.longitude != null &&
        !isNaN(home.latitude) && !isNaN(home.longitude)) {
      flyToLocation(home.latitude, home.longitude, 15)
    }
  }

  // Exclude 'home' from location types when categorizing
  const categorizableTypes = locationTypes.filter(t => t.value !== 'home')

  const defaultCenter: [number, number] = useMemo(() => {
    if (filter === 'homes' && homes.length > 0 && homes[0]?.latitude && homes[0]?.longitude) {
      return [homes[0].latitude, homes[0].longitude]
    }
    if (clusteredStops.length > 0 && clusteredStops[0]?.lat && clusteredStops[0]?.lng) {
      return [clusteredStops[0].lat, clusteredStops[0].lng]
    }
    return [39.0, 35.0] // Turkey center as fallback
  }, [filter, homes, clusteredStops])

  // Show error state
  const hasError = stopsError || homesError || typesError
  if (hasError) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Veri Yüklenemedi</h2>
          <p className="text-red-600">
            Durak verileri yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Sayfayı Yenile
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Durak Yönetimi</h1>
          <p className="text-sm sm:text-base text-gray-500">Şoför duraklarını analiz edin ve yönetin</p>
        </div>
        <button
          onClick={() => setShowDetectModal(true)}
          className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm sm:text-base"
        >
          <PlayIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Durakları Tespit Et</span>
          <span className="sm:hidden">Tespit Et</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <MapPinIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Toplam Durak</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.totalStops}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
              <UserGroupIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Sürücü Sayısı</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.uniqueDrivers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <ChartBarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Küme Sayısı</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.clusters}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg flex-shrink-0">
              <TruckIcon className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Ortak Noktalar</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.hotSpots}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg flex-shrink-0">
              <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Ort. Bekleme</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{formatDuration(stats.avgDuration)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border-b pb-2 sm:pb-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <button
            onClick={() => { setFilter('clusters'); setSelectedType(''); setSelectedCluster(null); setSelectedStop(null); }}
            className={`pb-2 px-3 sm:px-4 font-medium flex items-center gap-1 text-sm sm:text-base ${
              filter === 'clusters'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500'
            }`}
          >
            <ChartBarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Kümelenmiş</span>
            <span className="sm:hidden">Kümeler</span>
            <span className="text-xs">({clusteredStops.length})</span>
          </button>
          <button
            onClick={() => { setFilter('uncategorized'); setSelectedType(''); setSelectedCluster(null); setSelectedStop(null); }}
            className={`pb-2 px-3 sm:px-4 font-medium text-sm sm:text-base ${
              filter === 'uncategorized'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500'
            }`}
          >
            <span className="hidden sm:inline">Kategorize Edilmemiş</span>
            <span className="sm:hidden">Kategorisiz</span>
          </button>
          <button
            onClick={() => { setFilter('all'); setSelectedType(''); setSelectedCluster(null); setSelectedStop(null); }}
            className={`pb-2 px-3 sm:px-4 font-medium text-sm sm:text-base ${
              filter === 'all'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500'
            }`}
          >
            <span className="hidden sm:inline">Tüm Duraklar</span>
            <span className="sm:hidden">Tümü</span>
          </button>
          <button
            onClick={() => { setFilter('homes'); setSelectedCluster(null); setSelectedStop(null); }}
            className={`pb-2 px-3 sm:px-4 font-medium flex items-center gap-1 text-sm sm:text-base ${
              filter === 'homes'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500'
            }`}
          >
            <HomeIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Şoför Evleri</span>
            <span className="sm:hidden">Evler</span>
            <span className="text-xs">({homesTotal})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          {filter === 'clusters' && (
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg">
              <span className="text-xs text-gray-500 whitespace-nowrap">Mesafe:</span>
              <select
                value={clusterDistance}
                onChange={(e) => setClusterDistance(parseFloat(e.target.value))}
                className="text-sm border-0 bg-transparent font-medium text-primary-600 focus:ring-0 cursor-pointer"
              >
                {CLUSTER_DISTANCES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filter === 'all' && (
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Map - Mobile first */}
        <div className="lg:hidden bg-white rounded-lg shadow overflow-hidden">
          <div className="h-[250px] sm:h-[350px]">
            <MapContainer
              center={defaultCenter}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController center={mapCenter} zoom={mapZoom} />

              {filter === 'homes' ? (
                homes.filter(home => home.latitude != null && home.longitude != null).map((home) => (
                  <div key={home.id}>
                    <Marker
                      position={[home.latitude, home.longitude]}
                      icon={homeIcon}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{home.driver_name || 'Şoför'}</strong>
                          <br />
                          <span className="text-lg">🏠</span> {home.name || 'Ev'}
                        </div>
                      </Popup>
                    </Marker>
                    <Circle
                      center={[home.latitude, home.longitude]}
                      radius={home.radius || 500}
                      pathOptions={{
                        color: home.is_active ? '#22c55e' : '#ef4444',
                        fillColor: home.is_active ? '#22c55e' : '#ef4444',
                        fillOpacity: 0.2,
                      }}
                    />
                  </div>
                ))
              ) : filter === 'clusters' ? (
                filteredClusters.filter(c => c.lat != null && c.lng != null).map((cluster, index) => (
                  <Marker
                    key={index}
                    position={[cluster.lat, cluster.lng]}
                    icon={selectedCluster === cluster
                      ? selectedIcon
                      : createClusterIcon(cluster.stops.length, cluster.uniqueDrivers.length)
                    }
                    eventHandlers={{
                      click: () => handleClusterSelect(cluster),
                    }}
                  />
                ))
              ) : (
                stops.filter(stop => stop.latitude != null && stop.longitude != null).map((stop) => (
                  <Marker
                    key={stop.id}
                    position={[stop.latitude, stop.longitude]}
                    icon={selectedStop?.id === stop.id ? selectedIcon : defaultStopIcon}
                    eventHandlers={{
                      click: () => handleStopSelect(stop),
                    }}
                  />
                ))
              )}
            </MapContainer>
          </div>
        </div>

        {/* List Panel */}
        <div className="bg-white rounded-lg shadow overflow-hidden order-2 lg:order-1">
          <div className="p-3 sm:p-4 border-b">
            <h2 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">
              {filter === 'homes' ? 'Şoför Ev Adresleri' : filter === 'clusters' ? 'Ortak Durak Noktaları' : 'Duraklar'}
            </h2>
            {filter === 'clusters' && (
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 sm:h-5 sm:w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="İl, ilçe veya sürücü ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            )}
          </div>
          <div className="max-h-[400px] sm:max-h-[500px] lg:max-h-[600px] overflow-y-auto">
            {(isLoading || (filter === 'homes' && homesLoading)) ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : filter === 'homes' ? (
              homes.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <HomeIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>Henüz ev adresi eklenmemiş</p>
                </div>
              ) : (
                homes.map((home) => (
                  <button
                    key={home.id}
                    onClick={() => handleHomeSelect(home)}
                    className="w-full text-left p-4 border-b hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        <TruckIcon className="h-4 w-4 text-gray-400" />
                        {home.driver_name || 'Şoför'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🏠</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingHome(home); }}
                          className="p-1 text-gray-400 hover:text-primary-600"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
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
                  </button>
                ))
              )
            ) : filter === 'clusters' ? (
              filteredClusters.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MapPinIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>Durak bulunamadı</p>
                </div>
              ) : (
                filteredClusters.map((cluster, index) => (
                  <button
                    key={index}
                    onClick={() => handleClusterSelect(cluster)}
                    className={`w-full text-left p-4 border-b hover:bg-gray-50 ${
                      selectedCluster === cluster ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4 text-blue-500" />
                        {cluster.province || 'Bilinmeyen'}, {cluster.district || ''}
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        {cluster.stops.length} durak
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <UserGroupIcon className="h-4 w-4" />
                        {cluster.uniqueDrivers.length} sürücü
                      </span>
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        {formatDuration(cluster.totalDuration)}
                      </span>
                    </div>
                    {cluster.uniqueDrivers.length > 1 && (
                      <div className="mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded inline-block">
                        🔥 Ortak Nokta - {cluster.uniqueDrivers.length} farklı sürücü
                      </div>
                    )}
                  </button>
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
                  onClick={() => handleStopSelect(stop)}
                  className={`w-full text-left p-4 border-b hover:bg-gray-50 ${
                    selectedStop?.id === stop.id ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
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
                  {stop.name && (
                    <p className="text-sm font-medium text-primary-600 mb-1">
                      📍 {stop.name}
                    </p>
                  )}
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
                      {stop.started_at ? new Date(stop.started_at).toLocaleString('tr-TR') : '-'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Map - Desktop only */}
        <div className="hidden lg:block lg:col-span-2 bg-white rounded-lg shadow overflow-hidden order-1 lg:order-2">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Harita</h2>
            {(selectedStop || selectedCluster) && (
              <button
                onClick={() => { setSelectedStop(null); setSelectedCluster(null); setMapCenter(null); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Seçimi Temizle
              </button>
            )}
          </div>
          <div className="h-[600px]">
            <MapContainer
              center={defaultCenter}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController center={mapCenter} zoom={mapZoom} />

              {filter === 'homes' ? (
                homes.filter(home => home.latitude != null && home.longitude != null).map((home) => (
                  <div key={home.id}>
                    <Marker
                      position={[home.latitude, home.longitude]}
                      icon={homeIcon}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{home.driver_name || 'Şoför'}</strong>
                          <br />
                          <span className="text-lg">🏠</span> {home.name || 'Ev'}
                          <br />
                          Yarıçap: {home.radius || 500}m
                        </div>
                      </Popup>
                    </Marker>
                    <Circle
                      center={[home.latitude, home.longitude]}
                      radius={home.radius || 500}
                      pathOptions={{
                        color: home.is_active ? '#22c55e' : '#ef4444',
                        fillColor: home.is_active ? '#22c55e' : '#ef4444',
                        fillOpacity: 0.2,
                      }}
                    />
                  </div>
                ))
              ) : filter === 'clusters' ? (
                <>
                  {/* Kümeleri göster */}
                  {filteredClusters.filter(c => c.lat != null && c.lng != null).map((cluster, index) => (
                    <Marker
                      key={index}
                      position={[cluster.lat, cluster.lng]}
                      icon={selectedCluster === cluster
                        ? selectedIcon
                        : createClusterIcon(cluster.stops.length, cluster.uniqueDrivers.length)
                      }
                      eventHandlers={{
                        click: () => handleClusterSelect(cluster),
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[200px]">
                          <p className="font-semibold mb-2">{cluster.province}, {cluster.district}</p>
                          <div className="space-y-1">
                            <p><strong>Toplam Durak:</strong> {cluster.stops.length}</p>
                            <p><strong>Sürücü Sayısı:</strong> {cluster.uniqueDrivers.length}</p>
                            <p><strong>Toplam Bekleme:</strong> {formatDuration(cluster.totalDuration)}</p>
                          </div>
                          {cluster.uniqueDrivers.length > 1 && (
                            <p className="mt-2 text-orange-600 text-xs">
                              🔥 {cluster.uniqueDrivers.length} farklı sürücü bu noktada durdu
                            </p>
                          )}
                          <div className="mt-2 pt-2 border-t max-h-32 overflow-y-auto">
                            <p className="text-xs text-gray-500 mb-1">Sürücüler:</p>
                            {Array.from(new Set(cluster.stops.map(s => s.driver_name))).slice(0, 5).map((name, i) => (
                              <span key={i} className="inline-block bg-gray-100 text-gray-700 rounded px-1 py-0.5 text-xs mr-1 mb-1">
                                {name}
                              </span>
                            ))}
                            {cluster.uniqueDrivers.length > 5 && (
                              <span className="text-xs text-gray-500">+{cluster.uniqueDrivers.length - 5} daha</span>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {/* Seçili kümenin duraklarını göster */}
                  {selectedCluster && selectedCluster.stops.filter(s => s.latitude != null && s.longitude != null).map((stop) => (
                    <Circle
                      key={stop.id}
                      center={[stop.latitude, stop.longitude]}
                      radius={50}
                      pathOptions={{
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.3,
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{stop.driver_name}</strong>
                          <br />
                          {formatDuration(stop.duration_minutes)}
                          <br />
                          {stop.started_at ? new Date(stop.started_at).toLocaleString('tr-TR') : '-'}
                        </div>
                      </Popup>
                    </Circle>
                  ))}
                </>
              ) : (
                <>
                  {stops.filter(stop => stop.latitude != null && stop.longitude != null).map((stop) => (
                    <Marker
                      key={stop.id}
                      position={[stop.latitude, stop.longitude]}
                      icon={selectedStop?.id === stop.id ? selectedIcon : defaultStopIcon}
                      eventHandlers={{
                        click: () => handleStopSelect(stop),
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong>{stop.driver_name || 'Bilinmeyen'}</strong>
                          {stop.name && (
                            <>
                              <br />
                              <span className="text-primary-600 font-medium">📍 {stop.name}</span>
                            </>
                          )}
                          <br />
                          <span className="text-2xl">{locationTypeIcons[stop.location_type] || '❓'}</span>{' '}
                          {stop.location_label || 'Belirlenmedi'}
                          <br />
                          Süre: {formatDuration(stop.duration_minutes)}
                          <br />
                          {stop.started_at ? new Date(stop.started_at).toLocaleString('tr-TR') : '-'}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </>
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Cluster Detail Panel */}
      {selectedCluster && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <span className="truncate">{selectedCluster.province}, {selectedCluster.district} - Detaylı Analiz</span>
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                onChange={(e) => {
                  if (e.target.value && confirm(`Bu kümedeki ${selectedCluster.stops.length} durağın tipini değiştirmek istediğinize emin misiniz?`)) {
                    bulkUpdateMutation.mutate({
                      ids: selectedCluster.stops.map(s => s.id),
                      locationType: e.target.value,
                    })
                  }
                  e.target.value = ''
                }}
                className="text-xs sm:text-sm border border-gray-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2"
                disabled={bulkUpdateMutation.isPending}
              >
                <option value="">Toplu Tip</option>
                {locationTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {locationTypeIcons[type.value]} {type.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (confirm(`Bu kümedeki ${selectedCluster.stops.length} durağı silmek istediğinize emin misiniz?`)) {
                    bulkDeleteMutation.mutate(selectedCluster.stops.map(s => s.id))
                  }
                }}
                disabled={bulkDeleteMutation.isPending}
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <TrashIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{bulkDeleteMutation.isPending ? 'Siliniyor...' : 'Tümünü Sil'}</span>
                <span className="sm:hidden">{bulkDeleteMutation.isPending ? '...' : 'Sil'}</span>
              </button>
              <button
                onClick={() => setSelectedCluster(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Özet</h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li className="flex justify-between"><span>Toplam Durak:</span> <strong>{selectedCluster.stops.length}</strong></li>
                <li className="flex justify-between"><span>Farklı Sürücü:</span> <strong>{selectedCluster.uniqueDrivers.length}</strong></li>
                <li className="flex justify-between"><span>Toplam Bekleme:</span> <strong>{formatDuration(selectedCluster.totalDuration)}</strong></li>
                <li className="flex justify-between"><span>Ort. Bekleme:</span> <strong>{formatDuration(selectedCluster.stops.length > 0 ? Math.round(selectedCluster.totalDuration / selectedCluster.stops.length) : 0)}</strong></li>
              </ul>
            </div>
            <div className="md:col-span-2">
              <h4 className="font-medium text-gray-700 mb-2 text-sm sm:text-base">Bu Noktada Duran Sürücüler</h4>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-3 py-2 text-left">Sürücü</th>
                      <th className="px-2 sm:px-3 py-2 text-left">Durak</th>
                      <th className="px-2 sm:px-3 py-2 text-left">Süre</th>
                      <th className="px-2 sm:px-3 py-2 text-left hidden sm:table-cell">Son Ziyaret</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set(selectedCluster.stops.map(s => s.driver_id))).map(driverId => {
                      const driverStops = selectedCluster.stops.filter(s => s.driver_id === driverId)
                      const totalDuration = driverStops.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
                      const validDates = driverStops.filter(s => s.started_at).map(s => new Date(s.started_at).getTime())
                      const lastVisit = validDates.length > 0 ? new Date(Math.max(...validDates)) : null
                      return (
                        <tr key={driverId} className="border-b">
                          <td className="px-2 sm:px-3 py-2 font-medium truncate max-w-[100px] sm:max-w-none">{driverStops[0].driver_name}</td>
                          <td className="px-2 sm:px-3 py-2">{driverStops.length}</td>
                          <td className="px-2 sm:px-3 py-2">{formatDuration(totalDuration)}</td>
                          <td className="px-2 sm:px-3 py-2 text-gray-500 hidden sm:table-cell">{lastVisit ? lastVisit.toLocaleDateString('tr-TR') : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categorization Modal */}
      {selectedStop && !showHomeModal && filter !== 'clusters' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl p-4 sm:p-6 w-full sm:max-w-lg sm:mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Durak Düzenle</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">{selectedStop.driver_name}</p>
              <p className="text-sm text-gray-500">
                {formatDuration(selectedStop.duration_minutes)} bekledi
              </p>
              <p className="text-sm text-gray-500">
                {selectedStop.province}, {selectedStop.district}
              </p>
              <p className="text-sm text-gray-500">
                {selectedStop.started_at ? new Date(selectedStop.started_at).toLocaleString('tr-TR') : '-'}
              </p>
            </div>

            {/* Stop Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durak Adı (İsteğe Bağlı)
              </label>
              <input
                type="text"
                value={stopName}
                onChange={(e) => setStopName(e.target.value)}
                placeholder="Örn: Fabrika Girişi, Depo, Terminal..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              {stopName && (
                <button
                  onClick={() => updateMutation.mutate({
                    stopId: selectedStop.id,
                    name: stopName,
                  })}
                  disabled={updateMutation.isPending}
                  className="mt-2 w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
                >
                  {updateMutation.isPending ? 'Kaydediliyor...' : 'Sadece Adı Kaydet'}
                </button>
              )}
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
              <p className="text-sm text-gray-600 mb-2">Durak tipini seçin{stopName ? ' ve adla birlikte kaydet' : ''}:</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {categorizableTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => updateMutation.mutate({
                      stopId: selectedStop.id,
                      locationType: type.value,
                      name: stopName || undefined,
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

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setSelectedStop(null); setStopName(''); }}
                className="flex-1 py-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  if (confirm('Bu durağı silmek istediğinize emin misiniz?')) {
                    deleteStopMutation.mutate(selectedStop.id)
                  }
                }}
                disabled={deleteStopMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <TrashIcon className="h-4 w-4" />
                {deleteStopMutation.isPending ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Home Creation Modal */}
      {showHomeModal && selectedStop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl p-4 sm:p-6 w-full sm:max-w-md sm:mx-4 max-h-[90vh] overflow-y-auto">
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
                {selectedStop.latitude?.toFixed(6) || '-'}, {selectedStop.longitude?.toFixed(6) || '-'}
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
                  setHomeForm({ name: '', radius: 500 })
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl p-4 sm:p-6 w-full sm:max-w-md sm:mx-4 max-h-[90vh] overflow-y-auto">
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

      {/* Detect Stops Modal */}
      {showDetectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl p-4 sm:p-6 w-full sm:max-w-lg sm:mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PlayIcon className="h-5 w-5 text-primary-600" />
              Durak Tespiti
            </h3>
            <p className="text-gray-600 mb-4">
              Şoförlerin konum verilerinden sık durulan noktaları tespit edin.
              Belirli bir şoför seçebilir veya tüm şoförler için tespit yapabilirsiniz.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şoför Seçimi
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Tüm Şoförler</option>
                  {allDrivers.map((driver: any) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} {driver.surname} - {driver.phone}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDriverId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    <strong>Seçili Şoför:</strong>{' '}
                    {allDrivers.find((d: any) => d.id === selectedDriverId)?.name}{' '}
                    {allDrivers.find((d: any) => d.id === selectedDriverId)?.surname}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Bu şoförün konum geçmişinden duraklar tespit edilecek.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDetectModal(false)
                  setSelectedDriverId('')
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  if (selectedDriverId) {
                    detectForDriverMutation.mutate(selectedDriverId)
                  } else {
                    detectMutation.mutate()
                  }
                }}
                disabled={detectMutation.isPending || detectForDriverMutation.isPending}
                className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {(detectMutation.isPending || detectForDriverMutation.isPending) ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Tespit Ediliyor...
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4" />
                    {selectedDriverId ? 'Şoför İçin Tespit Et' : 'Tüm Şoförler İçin Tespit Et'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .selected-marker-icon div {
          animation: pulse 1s infinite;
        }
      `}</style>
    </div>
  )
}
