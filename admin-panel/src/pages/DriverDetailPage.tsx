import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { driversApi, notificationsApi, driverHomesApi } from '../services/api'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet'
import {
  ArrowLeftIcon,
  TruckIcon,
  MapPinIcon,
  ClockIcon,
  BellIcon,
  ChartBarIcon,
  HomeIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

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

interface Driver {
  id: string
  name: string
  surname: string
  phone: string
  email: string
  status: string
  current_status: string
  province: string
  district: string
  neighborhood?: string
  created_at: string
  is_active: boolean
  contacts_enabled: boolean
  call_log_enabled: boolean
  surveys_enabled: boolean
  questions_enabled: boolean
  vehicles: Array<{
    id: string
    brand: string
    model: string
    plate: string
    year?: number
    vehicle_type?: string
    tonnage?: number
    is_active: boolean
  }>
  trailers: Array<{
    id: string
    trailer_type: string
    plate: string
    is_active: boolean
  }>
}

interface Location {
  latitude: number
  longitude: number
  timestamp: string
  speed: number
}

interface Trip {
  id: string
  start_time: string
  end_time: string | null
  distance_km: number
  status: string
}

interface DriverHome {
  id: string
  driver_id: string
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

interface Stop {
  id: string
  latitude: number
  longitude: number
  location_type: string
  location_label: string
  province?: string
  district?: string
  started_at: string
  duration_minutes: number
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [notifTitle, setNotifTitle] = useState('')
  const [notifBody, setNotifBody] = useState('')
  const [sendingNotif, setSendingNotif] = useState(false)
  const [showHomeModal, setShowHomeModal] = useState(false)
  const [editingHome, setEditingHome] = useState<DriverHome | null>(null)
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [homeForm, setHomeForm] = useState({
    name: '',
    latitude: 0,
    longitude: 0,
    province: '',
    district: '',
    radius: 200,
  })

  const { data: driverData, isLoading: driverLoading } = useQuery({
    queryKey: ['driver', id],
    queryFn: () => driversApi.getById(id!),
    enabled: !!id,
  })

  const { data: locationsData } = useQuery({
    queryKey: ['driver-locations', id],
    queryFn: () => driversApi.getLocations(id!),
    enabled: !!id,
  })

  const { data: tripsData } = useQuery({
    queryKey: ['driver-trips', id],
    queryFn: () => driversApi.getTrips(id!, { limit: 10 }),
    enabled: !!id,
  })

  const { data: homesData } = useQuery({
    queryKey: ['driver-homes', id],
    queryFn: () => driverHomesApi.getByDriver(id!),
    enabled: !!id,
  })

  const { data: stopsData } = useQuery({
    queryKey: ['driver-stops', id],
    queryFn: () => driversApi.getStops(id!),
    enabled: !!id,
  })

  // Create home mutation
  const createHomeMutation = useMutation({
    mutationFn: (data: { name: string; latitude: number; longitude: number; province?: string; district?: string; radius: number }) =>
      driverHomesApi.create(id!, data),
    onSuccess: () => {
      toast.success('Ev adresi eklendi')
      queryClient.invalidateQueries({ queryKey: ['driver-homes', id] })
      setShowHomeModal(false)
      setSelectedStop(null)
      setHomeForm({ name: '', latitude: 0, longitude: 0, province: '', district: '', radius: 200 })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ev adresi eklenemedi')
    },
  })

  // Update home mutation
  const updateHomeMutation = useMutation({
    mutationFn: ({ homeId, data }: { homeId: string; data: { name?: string; radius?: number; is_active?: boolean } }) =>
      driverHomesApi.update(homeId, data),
    onSuccess: () => {
      toast.success('Ev adresi güncellendi')
      queryClient.invalidateQueries({ queryKey: ['driver-homes', id] })
      setEditingHome(null)
    },
    onError: () => {
      toast.error('Güncelleme başarısız')
    },
  })

  // Delete home mutation
  const deleteHomeMutation = useMutation({
    mutationFn: (homeId: string) => driverHomesApi.delete(homeId),
    onSuccess: () => {
      toast.success('Ev adresi silindi')
      queryClient.invalidateQueries({ queryKey: ['driver-homes', id] })
    },
    onError: () => {
      toast.error('Ev adresi silinemedi')
    },
  })

  // Update driver status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (isActive: boolean) => driversApi.updateStatus(id!, isActive),
    onSuccess: (_, isActive) => {
      toast.success(isActive ? 'Sürücü aktifleştirildi' : 'Sürücü pasifleştirildi')
      queryClient.invalidateQueries({ queryKey: ['driver', id] })
    },
    onError: () => {
      toast.error('Durum güncellenemedi')
    },
  })

  // Delete driver mutation
  const deleteDriverMutation = useMutation({
    mutationFn: () => driversApi.delete(id!),
    onSuccess: () => {
      toast.success('Sürücü silindi')
      navigate('/drivers')
    },
    onError: () => {
      toast.error('Sürücü silinemedi')
    },
  })

  // Update driver features mutation
  const updateFeaturesMutation = useMutation({
    mutationFn: (features: {
      contacts_enabled?: boolean;
      call_log_enabled?: boolean;
      surveys_enabled?: boolean;
      questions_enabled?: boolean;
    }) => driversApi.updateFeatures(id!, features),
    onSuccess: () => {
      toast.success('Özellik güncellendi')
      queryClient.invalidateQueries({ queryKey: ['driver', id] })
    },
    onError: () => {
      toast.error('Özellik güncellenemedi')
    },
  })

  const driver: Driver | null = driverData?.data || null
  const locations: Location[] = locationsData?.data?.locations || []
  const trips: Trip[] = tripsData?.data?.trips || []
  const homes: DriverHome[] = homesData?.data?.homes || []
  const canAddHome = homesData?.data?.can_add ?? true
  const stops: Stop[] = stopsData?.data?.stops || []

  // Get frequently visited stops (unknown type, sorted by duration)
  const frequentStops = stops
    .filter(s => s.location_type === 'unknown')
    .sort((a, b) => b.duration_minutes - a.duration_minutes)
    .slice(0, 10)

  const handleSendNotification = async () => {
    if (!notifTitle || !notifBody) {
      toast.error('Başlık ve içerik gerekli')
      return
    }

    setSendingNotif(true)
    try {
      await notificationsApi.send({
        driver_id: id!,
        title: notifTitle,
        body: notifBody,
      })
      toast.success('Bildirim gönderildi')
      setNotifTitle('')
      setNotifBody('')
    } catch {
      toast.error('Bildirim gönderilemedi')
    } finally {
      setSendingNotif(false)
    }
  }

  const handleSetStopAsHome = (stop: Stop) => {
    setSelectedStop(stop)
    setHomeForm({
      name: 'Ev',
      latitude: stop.latitude,
      longitude: stop.longitude,
      province: stop.province || '',
      district: stop.district || '',
      radius: 200,
    })
    setShowHomeModal(true)
  }

  const handleCreateHome = () => {
    if (!homeForm.name) return
    createHomeMutation.mutate({
      name: homeForm.name,
      latitude: homeForm.latitude,
      longitude: homeForm.longitude,
      province: homeForm.province || undefined,
      district: homeForm.district || undefined,
      radius: homeForm.radius,
    })
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} dk`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}s ${mins}dk`
  }

  if (driverLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Şoför bulunamadı</p>
        <Link to="/drivers" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
          Geri dön
        </Link>
      </div>
    )
  }

  const lastLocation = locations.length > 0 ? locations[0] : null
  const routeCoords: [number, number][] = locations.map((l) => [l.latitude, l.longitude])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/drivers"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {driver.name} {driver.surname}
          </h1>
          <p className="text-gray-500">{driver.phone}</p>
        </div>
        <Link
          to={`/drivers/${id}/routes`}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <ChartBarIcon className="h-5 w-5" />
          Güzergahları Gör
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Driver Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Şoför Bilgileri</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">E-posta</dt>
              <dd className="text-sm font-medium">{driver.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Kayıtlı Adres</dt>
              <dd className="text-sm font-medium">
                {driver.district}, {driver.province}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Kayıt Tarihi</dt>
              <dd className="text-sm font-medium">
                {new Date(driver.created_at).toLocaleDateString('tr-TR')}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Durum</dt>
              <dd>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                  {driver.status === 'active' ? 'Aktif' :
                   driver.status === 'on_trip' ? 'Seferde' :
                   driver.status === 'at_home' ? 'Evde' : 'Pasif'}
                </span>
              </dd>
            </div>
          </dl>

          {/* Driver Management Section */}
          <div className="mt-6 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Cog6ToothIcon className="h-4 w-4" />
              Sürücü Yönetimi
            </h3>
            <div className="space-y-3">
              {/* Status Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Hesap Durumu</span>
                <button
                  onClick={() => updateStatusMutation.mutate(!driver.is_active)}
                  disabled={updateStatusMutation.isPending}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    driver.is_active
                      ? 'bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-800'
                      : 'bg-red-100 text-red-800 hover:bg-green-100 hover:text-green-800'
                  }`}
                >
                  {updateStatusMutation.isPending
                    ? 'İşleniyor...'
                    : driver.is_active
                    ? 'Aktif - Tıkla Devre Dışı Bırak'
                    : 'Pasif - Tıkla Aktifleştir'}
                </button>
              </div>

              {/* Feature Toggles */}
              <div className="pt-2 border-t space-y-2">
                <p className="text-xs text-gray-500 font-medium">Özellik Kontrolleri</p>

                {/* Contacts */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Rehber Erişimi</span>
                  <button
                    onClick={() => updateFeaturesMutation.mutate({ contacts_enabled: !driver.contacts_enabled })}
                    disabled={updateFeaturesMutation.isPending}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      driver.contacts_enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {driver.contacts_enabled ? 'Açık' : 'Kapalı'}
                  </button>
                </div>

                {/* Call Log */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Arama Geçmişi</span>
                  <button
                    onClick={() => updateFeaturesMutation.mutate({ call_log_enabled: !driver.call_log_enabled })}
                    disabled={updateFeaturesMutation.isPending}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      driver.call_log_enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {driver.call_log_enabled ? 'Açık' : 'Kapalı'}
                  </button>
                </div>

                {/* Surveys */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Anketler</span>
                  <button
                    onClick={() => updateFeaturesMutation.mutate({ surveys_enabled: !driver.surveys_enabled })}
                    disabled={updateFeaturesMutation.isPending}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      driver.surveys_enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {driver.surveys_enabled ? 'Açık' : 'Kapalı'}
                  </button>
                </div>

                {/* Questions */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Sorular</span>
                  <button
                    onClick={() => updateFeaturesMutation.mutate({ questions_enabled: !driver.questions_enabled })}
                    disabled={updateFeaturesMutation.isPending}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      driver.questions_enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {driver.questions_enabled ? 'Açık' : 'Kapalı'}
                  </button>
                </div>
              </div>

              {/* Delete Driver */}
              <div className="pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                  Sürücüyü Sil
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Homes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HomeIcon className="h-5 w-5 text-green-600" />
            Ev Adresleri
            <span className="text-sm font-normal text-gray-500">({homes.length}/2)</span>
          </h2>

          {homes.length > 0 ? (
            <ul className="space-y-3 mb-4">
              {homes.map((home) => (
                <li key={home.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-800 flex items-center gap-1">
                        <span className="text-lg">🏠</span> {home.name}
                      </p>
                      <p className="text-sm text-green-600">
                        {home.province}, {home.district}
                      </p>
                      <p className="text-xs text-green-500">
                        Yarıçap: {home.radius}m
                        {!home.is_active && <span className="ml-2 text-red-500">(Pasif)</span>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingHome(home)}
                        className="p-1.5 text-green-600 hover:bg-green-100 rounded"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Bu ev adresini silmek istediğinize emin misiniz?')) {
                            deleteHomeMutation.mutate(home.id)
                          }
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-100 rounded"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm mb-4">Henüz ev adresi eklenmemiş</p>
          )}

          {/* Frequent Stops Section */}
          {frequentStops.length > 0 && canAddHome && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Sık Durduğu Yerler
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Bu noktalardan birini ev olarak işaretleyebilirsiniz
              </p>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {frequentStops.map((stop) => (
                  <li
                    key={stop.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
                  >
                    <div>
                      <p className="font-medium">{stop.province}, {stop.district}</p>
                      <p className="text-xs text-gray-500">
                        {formatDuration(stop.duration_minutes)} bekledi
                      </p>
                    </div>
                    <button
                      onClick={() => handleSetStopAsHome(stop)}
                      className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs"
                    >
                      <HomeIcon className="h-3 w-3" />
                      Ev Yap
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Vehicles */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TruckIcon className="h-5 w-5" />
            Araçlar
          </h2>
          {driver.vehicles && driver.vehicles.length > 0 ? (
            <ul className="space-y-3">
              {driver.vehicles.map((vehicle) => (
                <li key={vehicle.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{vehicle.brand} {vehicle.model}</p>
                    <p className="text-sm text-gray-500">{vehicle.plate}</p>
                  </div>
                  {vehicle.is_active && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Aktif
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">Araç kaydı yok</p>
          )}

          <h3 className="text-md font-semibold mt-6 mb-3">Dorseler</h3>
          {driver.trailers && driver.trailers.length > 0 ? (
            <ul className="space-y-3">
              {driver.trailers.map((trailer) => (
                <li key={trailer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{trailer.trailer_type}</p>
                    <p className="text-sm text-gray-500">{trailer.plate}</p>
                  </div>
                  {trailer.is_active && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Aktif
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">Dorse kaydı yok</p>
          )}
        </div>
      </div>

      {/* Map with Homes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPinIcon className="h-5 w-5" />
          Konum Geçmişi ve Ev Adresleri
        </h2>
        <div className="h-96 rounded-lg overflow-hidden">
          <MapContainer
            center={lastLocation ? [lastLocation.latitude, lastLocation.longitude] : [39.925533, 32.866287]}
            zoom={lastLocation ? 12 : 6}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Current Location */}
            {lastLocation && (
              <Marker position={[lastLocation.latitude, lastLocation.longitude]}>
                <Popup>
                  <div>
                    <strong>{driver.name} {driver.surname}</strong>
                    <br />
                    Son konum: {new Date(lastLocation.timestamp).toLocaleString('tr-TR')}
                    <br />
                    Hız: {lastLocation.speed.toFixed(1)} km/s
                  </div>
                </Popup>
              </Marker>
            )}
            {/* Route */}
            {routeCoords.length > 1 && (
              <Polyline positions={routeCoords} color="blue" weight={3} opacity={0.7} />
            )}
            {/* Home Locations with radius */}
            {homes.map((home) => (
              <div key={home.id}>
                <Marker
                  position={[home.latitude, home.longitude]}
                  icon={homeIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>🏠 {home.name}</strong>
                      <br />
                      {home.province}, {home.district}
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
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Send Notification & Trips Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Notification */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BellIcon className="h-5 w-5" />
            Bildirim Gönder
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlık
              </label>
              <input
                type="text"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Bildirim başlığı"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İçerik
              </label>
              <textarea
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Bildirim içeriği"
              />
            </div>
            <button
              onClick={handleSendNotification}
              disabled={sendingNotif}
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {sendingNotif ? 'Gönderiliyor...' : 'Gönder'}
            </button>
          </div>
        </div>

        {/* Trips */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Son Seferler
          </h2>
          {trips.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Başlangıç
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Mesafe
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Durum
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {trips.map((trip) => (
                    <tr key={trip.id}>
                      <td className="px-4 py-3 text-sm">
                        {new Date(trip.start_time).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {trip.distance_km.toFixed(1)} km
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            trip.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {trip.status === 'completed' ? 'Tamamlandı' : 'Devam Ediyor'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Sefer kaydı yok</p>
          )}
        </div>
      </div>

      {/* Home Creation Modal */}
      {showHomeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <HomeIcon className="h-5 w-5 text-green-600" />
              Ev Adresi Ekle
            </h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">{driver.name} {driver.surname}</p>
              {selectedStop && (
                <>
                  <p className="text-sm text-gray-500">
                    {selectedStop.province}, {selectedStop.district}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {selectedStop.latitude.toFixed(6)}, {selectedStop.longitude.toFixed(6)}
                  </p>
                </>
              )}
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
                  setSelectedStop(null)
                  setHomeForm({ name: '', latitude: 0, longitude: 0, province: '', district: '', radius: 200 })
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Sürücüyü Sil</h3>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                <strong>{driver?.name} {driver?.surname}</strong> ({driver?.phone}) adlı sürücüyü silmek istediğinize emin misiniz?
              </p>
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                Bu işlem geri alınamaz! Sürücüye ait tüm veriler (araçlar, dorseler, konum geçmişi, seferler, anket yanıtları) kalıcı olarak silinecektir.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  deleteDriverMutation.mutate()
                  setShowDeleteConfirm(false)
                }}
                disabled={deleteDriverMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <TrashIcon className="h-4 w-4" />
                {deleteDriverMutation.isPending ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
