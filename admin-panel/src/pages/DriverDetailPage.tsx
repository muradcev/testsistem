import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { driversApi, notificationsApi, driverHomesApi } from '../services/api'
import { useRouteGeometry } from '../hooks/useRouteGeometry'
import { formatTurkeyDate } from '../utils/dateUtils'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet'
import {
  ArrowLeftIcon,
  TruckIcon,
  MapPinIcon,
  BellIcon,
  ChartBarIcon,
  HomeIcon,
  TrashIcon,
  PencilIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  DevicePhoneMobileIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Modal,
  EmptyState,
  LoadingSpinner,
  MiniStatCard,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui'
import clsx from 'clsx'

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
  last_location_at?: string
  last_latitude?: number
  last_longitude?: number
  home_latitude?: number | null
  home_longitude?: number | null
  last_active_at?: string
  app_version?: string
  device_os?: string
  has_app?: boolean
  battery_optimization_disabled?: boolean
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

// Time elapsed helper function
function formatTimeElapsed(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Az once'
  if (diffMins < 60) return `${diffMins} dk once`
  if (diffHours < 24) return `${diffHours} saat once`
  if (diffDays < 7) return `${diffDays} gun once`
  return date.toLocaleDateString('tr-TR')
}

// Calculate distance between two coordinates in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
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

interface GroupedStop {
  id: string
  latitude: number
  longitude: number
  province?: string
  district?: string
  total_duration_minutes: number
  stop_count: number
  stops: Stop[]
}

function groupStopsByProximity(stops: Stop[], radiusMeters: number = 500): GroupedStop[] {
  const groups: GroupedStop[] = []
  const used = new Set<string>()

  for (const stop of stops) {
    if (used.has(stop.id)) continue

    const group: GroupedStop = {
      id: stop.id,
      latitude: stop.latitude,
      longitude: stop.longitude,
      province: stop.province,
      district: stop.district,
      total_duration_minutes: stop.duration_minutes,
      stop_count: 1,
      stops: [stop],
    }

    used.add(stop.id)

    for (const other of stops) {
      if (used.has(other.id)) continue
      const distance = calculateDistanceMeters(stop.latitude, stop.longitude, other.latitude, other.longitude)
      if (distance <= radiusMeters) {
        group.total_duration_minutes += other.duration_minutes
        group.stop_count++
        group.stops.push(other)
        used.add(other.id)
      }
    }

    groups.push(group)
  }

  return groups.sort((a, b) => b.total_duration_minutes - a.total_duration_minutes)
}

interface Location {
  id: number
  latitude: number
  longitude: number
  speed: number
  speed_kmh?: number
  accuracy: number
  altitude: number
  heading: number
  is_moving: boolean
  activity_type: string
  battery_level?: number
  is_charging?: boolean
  power_save_mode?: boolean
  phone_in_use: boolean
  // Ağ bilgileri
  connection_type?: string
  wifi_ssid?: string
  ip_address?: string
  // Sensör verileri
  accelerometer?: { x: number; y: number; z: number }
  gyroscope?: { x: number; y: number; z: number }
  max_acceleration_g?: number
  // Meta veriler
  trigger?: string
  interval_seconds?: number
  recorded_at: string
  created_at: string
}

interface Trip {
  id: string
  started_at: string
  ended_at: string | null
  distance_km: number
  duration_minutes: number
  status: string
  start_latitude: number
  start_longitude: number
  start_address?: string
  start_province?: string
  end_latitude?: number
  end_longitude?: number
  end_address?: string
  end_province?: string
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

interface CallLog {
  id: string
  phone_number: string
  contact_name?: string
  call_type: string
  duration_seconds: number
  call_timestamp: string
}

interface Contact {
  id: string
  name: string
  phone_numbers: string[]
  contact_type?: string
  synced_at: string
}

interface SurveyResponse {
  id: string
  survey_title: string
  survey_type: string
  answer: string
  created_at: string
}

interface QuestionResponse {
  id: string
  question_text: string
  question_type: string
  answer_text?: string
  status: string
  answered_at?: string
  created_at: string
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  active: { label: 'Aktif', variant: 'success' },
  inactive: { label: 'Pasif', variant: 'default' },
  passive: { label: 'Pasif', variant: 'default' },
  on_trip: { label: 'Seferde', variant: 'warning' },
  at_home: { label: 'Evde', variant: 'info' },
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [notifTitle, setNotifTitle] = useState('')
  const [notifBody, setNotifBody] = useState('')
  const [sendingNotif, setSendingNotif] = useState(false)
  const [showHomeModal, setShowHomeModal] = useState(false)
  const [editingHome, setEditingHome] = useState<DriverHome | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteCallLogsConfirm, setShowDeleteCallLogsConfirm] = useState(false)
  const [showDeleteContactsConfirm, setShowDeleteContactsConfirm] = useState(false)
  const [showDeleteSurveyResponsesConfirm, setShowDeleteSurveyResponsesConfirm] = useState(false)
  const [showDeleteQuestionResponsesConfirm, setShowDeleteQuestionResponsesConfirm] = useState(false)
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

  const { data: callLogsData, isLoading: callLogsLoading } = useQuery({
    queryKey: ['driver-call-logs', id],
    queryFn: () => driversApi.getCallLogs(id!, { limit: 100 }),
    enabled: !!id && activeTab === 'communication',
  })

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['driver-contacts', id],
    queryFn: () => driversApi.getContacts(id!, { limit: 100 }),
    enabled: !!id && activeTab === 'communication',
  })

  const { data: responsesData, isLoading: responsesLoading } = useQuery({
    queryKey: ['driver-responses', id],
    queryFn: () => driversApi.getResponses(id!),
    enabled: !!id && activeTab === 'responses',
  })

  // Mutations
  const createHomeMutation = useMutation({
    mutationFn: (data: { name: string; latitude: number; longitude: number; province?: string; district?: string; radius: number }) =>
      driverHomesApi.create(id!, data),
    onSuccess: () => {
      toast.success('Ev adresi eklendi')
      queryClient.invalidateQueries({ queryKey: ['driver-homes', id] })
      setShowHomeModal(false)
      setHomeForm({ name: '', latitude: 0, longitude: 0, province: '', district: '', radius: 200 })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ev adresi eklenemedi')
    },
  })

  const updateHomeMutation = useMutation({
    mutationFn: ({ homeId, data }: { homeId: string; data: { name?: string; latitude?: number; longitude?: number; radius?: number; is_active?: boolean } }) =>
      driverHomesApi.update(homeId, data),
    onSuccess: () => {
      toast.success('Ev adresi guncellendi')
      queryClient.invalidateQueries({ queryKey: ['driver-homes', id] })
      setEditingHome(null)
    },
    onError: () => toast.error('Guncelleme basarisiz'),
  })

  const deleteHomeMutation = useMutation({
    mutationFn: (homeId: string) => driverHomesApi.delete(homeId),
    onSuccess: () => {
      toast.success('Ev adresi silindi')
      queryClient.invalidateQueries({ queryKey: ['driver-homes', id] })
    },
    onError: () => toast.error('Ev adresi silinemedi'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: (isActive: boolean) => driversApi.updateStatus(id!, isActive),
    onSuccess: (_, isActive) => {
      toast.success(isActive ? 'Surucu aktiflesti' : 'Surucu pasif yapildi')
      queryClient.invalidateQueries({ queryKey: ['driver', id] })
    },
    onError: () => toast.error('Durum guncellenemedi'),
  })

  const deleteDriverMutation = useMutation({
    mutationFn: () => driversApi.delete(id!),
    onSuccess: () => {
      toast.success('Surucu silindi')
      navigate('/drivers')
    },
    onError: () => toast.error('Surucu silinemedi'),
  })

  const updateFeaturesMutation = useMutation({
    mutationFn: (features: {
      contacts_enabled?: boolean;
      call_log_enabled?: boolean;
      surveys_enabled?: boolean;
      questions_enabled?: boolean;
    }) => driversApi.updateFeatures(id!, features),
    onSuccess: () => {
      toast.success('Ozellik guncellendi')
      queryClient.invalidateQueries({ queryKey: ['driver', id] })
    },
    onError: () => toast.error('Ozellik guncellenemedi'),
  })


  const deleteCallLogsMutation = useMutation({
    mutationFn: () => driversApi.deleteCallLogs(id!),
    onSuccess: () => {
      toast.success('Arama gecmisi silindi')
      queryClient.invalidateQueries({ queryKey: ['driver-call-logs', id] })
      setShowDeleteCallLogsConfirm(false)
    },
    onError: () => toast.error('Arama gecmisi silinemedi'),
  })

  const deleteContactsMutation = useMutation({
    mutationFn: () => driversApi.deleteContacts(id!),
    onSuccess: () => {
      toast.success('Rehber silindi')
      queryClient.invalidateQueries({ queryKey: ['driver-contacts', id] })
      setShowDeleteContactsConfirm(false)
    },
    onError: () => toast.error('Rehber silinemedi'),
  })

  const requestCallLogSyncMutation = useMutation({
    mutationFn: () => notificationsApi.requestCallLogSync(id!),
    onSuccess: () => {
      toast.success('Arama gecmisi senkronizasyon istegi gonderildi')
    },
    onError: () => toast.error('Istek gonderilemedi - FCM token olmayabilir'),
  })

  const requestContactSyncMutation = useMutation({
    mutationFn: () => notificationsApi.requestContactSync(id!),
    onSuccess: () => {
      toast.success('Rehber senkronizasyon istegi gonderildi')
    },
    onError: () => toast.error('Istek gonderilemedi - FCM token olmayabilir'),
  })

  const deleteSurveyResponsesMutation = useMutation({
    mutationFn: () => driversApi.deleteSurveyResponses(id!),
    onSuccess: () => {
      toast.success('Anket cevaplari silindi')
      queryClient.invalidateQueries({ queryKey: ['driver-responses', id] })
      setShowDeleteSurveyResponsesConfirm(false)
    },
    onError: () => toast.error('Anket cevaplari silinemedi'),
  })

  const deleteQuestionResponsesMutation = useMutation({
    mutationFn: () => driversApi.deleteQuestionResponses(id!),
    onSuccess: () => {
      toast.success('Soru cevaplari silindi')
      queryClient.invalidateQueries({ queryKey: ['driver-responses', id] })
      setShowDeleteQuestionResponsesConfirm(false)
    },
    onError: () => toast.error('Soru cevaplari silinemedi'),
  })

  const driver: Driver | null = driverData?.data || null
  const locations: Location[] = locationsData?.data?.locations || []
  const trips: Trip[] = tripsData?.data?.trips || []
  const homes: DriverHome[] = homesData?.data?.homes || []
  const canAddHome = homesData?.data?.can_add ?? true
  const stops: Stop[] = stopsData?.data?.stops || []
  const callLogs: CallLog[] = callLogsData?.data?.call_logs || []
  const contacts: Contact[] = contactsData?.data?.contacts || []
  const surveyResponses: SurveyResponse[] = responsesData?.data?.survey_responses || []
  const questionResponses: QuestionResponse[] = responsesData?.data?.question_responses || []

  // OSRM ile gerçek karayolu rotası al - Hook'lar early return'den önce olmalı!
  const { geometry: routeCoords } = useRouteGeometry(
    locations,
    { enabled: locations.length >= 2, maxPoints: 50 }
  )

  const frequentStops = useMemo(() => {
    const unknownStops = stops.filter(s => s.location_type === 'unknown')
    return groupStopsByProximity(unknownStops, 200).slice(0, 10)
  }, [stops])

  const handleSendNotification = async () => {
    if (!notifTitle || !notifBody) {
      toast.error('Baslik ve icerik gerekli')
      return
    }

    setSendingNotif(true)
    try {
      await notificationsApi.send({
        driver_id: id!,
        title: notifTitle,
        body: notifBody,
      })
      toast.success('Bildirim gonderildi')
      setNotifTitle('')
      setNotifBody('')
    } catch {
      toast.error('Bildirim gonderilemedi')
    } finally {
      setSendingNotif(false)
    }
  }

  const handleSetStopAsHome = (groupedStop: GroupedStop) => {
    setHomeForm({
      name: 'Ev',
      latitude: groupedStop.latitude,
      longitude: groupedStop.longitude,
      province: groupedStop.province || '',
      district: groupedStop.district || '',
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
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!driver) {
    return (
      <EmptyState
        icon={UserGroupIcon}
        title="Sofor bulunamadi"
        description="Aradiginiz sofor bulunamadi"
        action={
          <Link to="/drivers">
            <Button>Geri Don</Button>
          </Link>
        }
      />
    )
  }

  const lastLocation = locations.length > 0 ? locations[0] : null

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
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {driver.name.charAt(0)}{driver.surname.charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {driver.name} {driver.surname}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-gray-500">{driver.phone}</span>
                <Badge variant={statusConfig[driver.status]?.variant || 'default'} dot>
                  {statusConfig[driver.status]?.label || driver.status}
                </Badge>
                {driver.has_app && (
                  <Badge variant="success" size="sm">
                    <DevicePhoneMobileIcon className="h-3 w-3 mr-1" />
                    v{driver.app_version}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <Link
          to={`/drivers/${id}/routes`}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <ChartBarIcon className="h-5 w-5" />
          Guzergahlar
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStatCard
          title="Son Konum"
          value={formatTimeElapsed(driver.last_location_at)}
          icon={MapPinIcon}
          color="blue"
        />
        <MiniStatCard
          title="Toplam Sefer"
          value={trips.length}
          icon={TruckIcon}
          color="orange"
        />
        <MiniStatCard
          title="Arac Sayisi"
          value={driver.vehicles?.length || 0}
          icon={TruckIcon}
          color="green"
        />
        <MiniStatCard
          title="Kayit Tarihi"
          value={new Date(driver.created_at).toLocaleDateString('tr-TR')}
          icon={CalendarIcon}
          color="purple"
        />
      </div>

      {/* Main Content with Tabs */}
      <Card>
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="border-b">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview" className="gap-2">
                <EyeIcon className="h-4 w-4" />
                Genel Bakis
              </TabsTrigger>
              <TabsTrigger value="locations" className="gap-2">
                <MapPinIcon className="h-4 w-4" />
                Konum
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="gap-2">
                <TruckIcon className="h-4 w-4" />
                Araclar
              </TabsTrigger>
              <TabsTrigger value="communication" className="gap-2">
                <PhoneIcon className="h-4 w-4" />
                Iletisim
                <Badge variant="default" size="sm">{callLogs.length + contacts.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="responses" className="gap-2">
                <ChatBubbleLeftRightIcon className="h-4 w-4" />
                Cevaplar
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Cog6ToothIcon className="h-4 w-4" />
                Ayarlar
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="p-6">
            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Driver Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Sofor Bilgileri</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm text-gray-500">E-posta</dt>
                        <dd className="text-sm font-medium">{driver.email}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Kayitli Adres</dt>
                        <dd className="text-sm font-medium">
                          {driver.district}, {driver.province}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Cihaz</dt>
                        <dd className="text-sm font-medium">
                          {driver.device_os === 'ios' ? 'iPhone' : 'Android'}
                          {driver.app_version && ` - v${driver.app_version}`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Son Aktivite</dt>
                        <dd className="text-sm font-medium">
                          {formatTimeElapsed(driver.last_active_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Pil Optimizasyonu</dt>
                        <dd className="text-sm font-medium flex items-center gap-2">
                          {driver.battery_optimization_disabled ? (
                            <>
                              <span className="text-green-600">✓ Devre Disi</span>
                              <span className="text-xs text-gray-400">(Arka plan takibi aktif)</span>
                            </>
                          ) : (
                            <>
                              <span className="text-red-600">✗ Aktif</span>
                              <span className="text-xs text-gray-400">(Konum takibi sorunlu olabilir)</span>
                            </>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {/* Last Location */}
                {driver.last_latitude && driver.last_longitude && (
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader>
                      <CardTitle className="text-blue-800 flex items-center gap-2">
                        <MapPinIcon className="h-5 w-5" />
                        Son Konum
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold text-blue-900 mb-2">
                        {driver.last_latitude.toFixed(6)}, {driver.last_longitude.toFixed(6)}
                      </p>
                      <p className="text-sm text-blue-700 mb-4">
                        {formatTimeElapsed(driver.last_location_at)}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${driver.last_latitude},${driver.last_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                      >
                        <MapPinIcon className="h-4 w-4" />
                        Haritada Gor
                      </a>
                    </CardContent>
                  </Card>
                )}

                {/* Driver Homes (Multiple) */}
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-green-800 flex items-center gap-2">
                      <HomeIcon className="h-5 w-5" />
                      Ev Adresleri ({homes.length}/2)
                    </CardTitle>
                    {canAddHome && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (driver.last_latitude && driver.last_longitude) {
                            setHomeForm({
                              name: `Ev ${homes.length + 1}`,
                              latitude: driver.last_latitude,
                              longitude: driver.last_longitude,
                              province: driver.province || '',
                              district: driver.district || '',
                              radius: 200,
                            })
                          } else {
                            setHomeForm({
                              name: `Ev ${homes.length + 1}`,
                              latitude: 0,
                              longitude: 0,
                              province: '',
                              district: '',
                              radius: 200,
                            })
                          }
                          setShowHomeModal(true)
                        }}
                      >
                        <HomeIcon className="h-4 w-4 mr-1" />
                        Yeni Ev Ekle
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-gray-500 mb-3">
                      Sofor ev bolgelerinden birine girdiginde sefer 30 dk icinde biter, ciktiginda 2 dk icinde baslar.
                    </p>
                    {homes.length > 0 ? (
                      <div className="space-y-2">
                        {homes.map((home) => (
                          <div
                            key={home.id}
                            className={clsx(
                              'flex items-center justify-between p-3 rounded-lg border',
                              home.is_active
                                ? 'bg-white border-green-200'
                                : 'bg-gray-100 border-gray-200'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{home.is_active ? '🏠' : '🏚️'}</span>
                              <div>
                                <p className="font-medium text-gray-800">
                                  {home.name}
                                  {!home.is_active && (
                                    <span className="ml-2 text-xs text-gray-500">(Pasif)</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {home.province && home.district
                                    ? `${home.district}, ${home.province}`
                                    : `${home.latitude.toFixed(5)}, ${home.longitude.toFixed(5)}`}
                                </p>
                                <p className="text-xs text-gray-400">Yaricap: {home.radius}m</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingHome(home)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                                title="Duzenle"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`"${home.name}" ev adresini silmek istediginize emin misiniz?`)) {
                                    deleteHomeMutation.mutate(home.id)
                                  }
                                }}
                                className="p-2 text-red-500 hover:bg-red-100 rounded"
                                title="Sil"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm mb-2">Henuz ev adresi tanimlanmamis</p>
                        <p className="text-xs">
                          Konum sekmesindeki "Sik Durdugu Yerler"den ev ekleyebilir veya
                          yukardaki butonu kullanabilirsiniz.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Notification Sender */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BellIcon className="h-5 w-5" />
                    Bildirim Gonder
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Baslik</label>
                      <input
                        type="text"
                        value={notifTitle}
                        onChange={(e) => setNotifTitle(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="Bildirim basligi"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Icerik</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={notifBody}
                          onChange={(e) => setNotifBody(e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                          placeholder="Bildirim icerigi"
                        />
                        <Button onClick={handleSendNotification} disabled={sendingNotif}>
                          {sendingNotif ? <LoadingSpinner size="sm" /> : 'Gonder'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Locations Tab */}
            <TabsContent value="locations">
              <div className="space-y-6">
                {/* Map */}
                <div className="h-96 rounded-lg overflow-hidden border">
                  <MapContainer
                    center={lastLocation ? [lastLocation.latitude, lastLocation.longitude] : [39.925533, 32.866287]}
                    zoom={lastLocation ? 12 : 6}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {lastLocation && (
                      <Marker position={[lastLocation.latitude, lastLocation.longitude]}>
                        <Popup>
                          <strong>{driver.name} {driver.surname}</strong>
                          <br />
                          Son: {formatTurkeyDate(lastLocation.recorded_at)}
                          <br />
                          Hiz: {lastLocation.speed.toFixed(1)} km/h
                        </Popup>
                      </Marker>
                    )}
                    {routeCoords.length > 1 && (
                      <Polyline positions={routeCoords} color="blue" weight={3} opacity={0.7} />
                    )}
                    {homes.map((home) => (
                      <div key={home.id}>
                        <Marker position={[home.latitude, home.longitude]} icon={homeIcon}>
                          <Popup>🏠 {home.name} | {home.radius}m</Popup>
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
                    {frequentStops.slice(0, 5).map((groupedStop, index) => (
                      <div key={`stop-${groupedStop.id}`}>
                        <Circle
                          center={[groupedStop.latitude, groupedStop.longitude]}
                          radius={200}
                          pathOptions={{
                            color: '#f59e0b',
                            fillColor: '#f59e0b',
                            fillOpacity: 0.15,
                            dashArray: '5, 5',
                          }}
                        >
                          <Popup>
                            📍 Sik Durulan Yer #{index + 1}
                            <br />
                            {formatDuration(groupedStop.total_duration_minutes)} bekleme
                          </Popup>
                        </Circle>
                      </div>
                    ))}
                  </MapContainer>
                </div>

                {/* Recent Locations Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Son GPS Konumlari ({locations.length} kayit)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {locations.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Koordinat</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hiz</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pil</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ag</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kaynak</th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harita</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {locations.slice(0, 20).map((loc, index) => {
                              const date = new Date(loc.recorded_at)
                              const speedKmh = loc.speed_kmh ?? (loc.speed * 3.6)
                              return (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-3 py-3 text-sm">
                                    {formatTurkeyDate(date)}
                                  </td>
                                  <td className="px-3 py-3 text-sm font-mono text-xs">
                                    {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                                    {loc.accuracy && (
                                      <span className="text-gray-400 ml-1">(±{loc.accuracy.toFixed(0)}m)</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <Badge
                                      variant={speedKmh > 100 ? 'error' : speedKmh > 50 ? 'warning' : 'success'}
                                      size="sm"
                                    >
                                      {speedKmh.toFixed(0)} km/h
                                    </Badge>
                                    {loc.is_moving && <span className="ml-1 text-xs">🚗</span>}
                                  </td>
                                  <td className="px-3 py-3 text-sm">
                                    {loc.battery_level !== undefined && (
                                      <div className="flex items-center gap-1">
                                        <span className={clsx(
                                          'font-medium',
                                          loc.battery_level <= 20 ? 'text-red-600' :
                                          loc.battery_level <= 50 ? 'text-yellow-600' : 'text-green-600'
                                        )}>
                                          {loc.battery_level}%
                                        </span>
                                        {loc.is_charging && <span title="Sarj oluyor">⚡</span>}
                                        {loc.power_save_mode && <span title="Guc tasarrufu" className="text-xs">🔋</span>}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-xs">
                                    {loc.connection_type && (
                                      <div>
                                        <Badge
                                          variant={loc.connection_type === 'wifi' ? 'info' : loc.connection_type === 'mobile' ? 'warning' : 'default'}
                                          size="sm"
                                        >
                                          {loc.connection_type === 'wifi' ? '📶 WiFi' :
                                           loc.connection_type === 'mobile' ? '📱 Mobil' : loc.connection_type}
                                        </Badge>
                                        {loc.wifi_ssid && (
                                          <p className="text-gray-400 text-xs mt-1" title={loc.wifi_ssid}>
                                            {loc.wifi_ssid.length > 12 ? loc.wifi_ssid.slice(0, 12) + '...' : loc.wifi_ssid}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-xs text-gray-500">
                                    {loc.trigger && (
                                      <span title={`Interval: ${loc.interval_seconds || '-'}s`}>
                                        {loc.trigger === 'foreground_service' ? '🟢 FG' :
                                         loc.trigger === 'workmanager' ? '🔵 WM' :
                                         loc.trigger === 'immediate' ? '⚡ IMM' : loc.trigger}
                                      </span>
                                    )}
                                    {loc.max_acceleration_g !== undefined && loc.max_acceleration_g > 0.5 && (
                                      <span className="ml-1" title={`Max ivme: ${loc.max_acceleration_g.toFixed(2)}G`}>
                                        💨
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3">
                                    <a
                                      href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary-600 hover:underline text-sm"
                                    >
                                      Ac
                                    </a>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState
                        icon={MapPinIcon}
                        title="Konum verisi yok"
                        description="Henuz konum verisi gelmemis"
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Frequent Stops */}
                {frequentStops.length > 0 && canAddHome && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Sik Durdugu Yerler</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500 mb-4">Bu noktalardan birini ev olarak isaretleyebilirsiniz</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {frequentStops.map((groupedStop) => (
                          <div
                            key={groupedStop.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <p className="font-medium">
                                {groupedStop.province || groupedStop.district || `${groupedStop.latitude.toFixed(5)}, ${groupedStop.longitude.toFixed(5)}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDuration(groupedStop.total_duration_minutes)} bekledi
                                {groupedStop.stop_count > 1 && ` (${groupedStop.stop_count} durak)`}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetStopAsHome(groupedStop)}
                              className="gap-1"
                            >
                              <HomeIcon className="h-4 w-4" />
                              Ev Yap
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Vehicles Tab */}
            <TabsContent value="vehicles">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vehicles */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TruckIcon className="h-5 w-5" />
                      Araclar ({driver.vehicles?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {driver.vehicles && driver.vehicles.length > 0 ? (
                      <ul className="space-y-3">
                        {driver.vehicles.map((vehicle) => (
                          <li key={vehicle.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-semibold text-gray-900">{vehicle.brand} {vehicle.model}</p>
                              <p className="text-sm text-gray-500">{vehicle.plate}</p>
                              {vehicle.year && <p className="text-xs text-gray-400">{vehicle.year} Model</p>}
                            </div>
                            {vehicle.is_active && (
                              <Badge variant="success">Aktif</Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState
                        icon={TruckIcon}
                        title="Arac kaydi yok"
                        description="Henuz arac eklenmemis"
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Trailers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Dorseler ({driver.trailers?.length || 0})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {driver.trailers && driver.trailers.length > 0 ? (
                      <ul className="space-y-3">
                        {driver.trailers.map((trailer) => (
                          <li key={trailer.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-semibold text-gray-900">{trailer.trailer_type}</p>
                              <p className="text-sm text-gray-500">{trailer.plate}</p>
                            </div>
                            {trailer.is_active && (
                              <Badge variant="success">Aktif</Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState
                        icon={TruckIcon}
                        title="Dorse kaydi yok"
                        description="Henuz dorse eklenmemis"
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Trips */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TruckIcon className="h-5 w-5" />
                      Son Seferler
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {trips.length > 0 ? (
                      <div className="space-y-4">
                        {/* Trip Map */}
                        <div className="h-64 rounded-lg overflow-hidden border">
                          <MapContainer
                            center={[trips[0]?.start_latitude || 39.925533, trips[0]?.start_longitude || 32.866287]}
                            zoom={6}
                            style={{ height: '100%', width: '100%' }}
                          >
                            <TileLayer
                              attribution='&copy; OpenStreetMap'
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {trips.map((trip, idx) => (
                              <div key={trip.id}>
                                {/* Start point - green */}
                                <Circle
                                  center={[trip.start_latitude, trip.start_longitude]}
                                  radius={1000}
                                  pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.6 }}
                                >
                                  <Popup>
                                    <strong>Baslangic #{idx + 1}</strong><br />
                                    {trip.start_province || 'Bilinmiyor'}<br />
                                    {formatTurkeyDate(trip.started_at)}
                                  </Popup>
                                </Circle>
                                {/* End point - red */}
                                {trip.end_latitude && trip.end_longitude && (
                                  <Circle
                                    center={[trip.end_latitude, trip.end_longitude]}
                                    radius={1000}
                                    pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.6 }}
                                  >
                                    <Popup>
                                      <strong>Bitis #{idx + 1}</strong><br />
                                      {trip.end_province || 'Bilinmiyor'}<br />
                                      {trip.ended_at ? formatTurkeyDate(trip.ended_at) : 'Devam Ediyor'}
                                    </Popup>
                                  </Circle>
                                )}
                                {/* Line connecting start to end */}
                                {trip.end_latitude && trip.end_longitude && (
                                  <Polyline
                                    positions={[
                                      [trip.start_latitude, trip.start_longitude],
                                      [trip.end_latitude, trip.end_longitude]
                                    ]}
                                    pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '5, 5' }}
                                  />
                                )}
                              </div>
                            ))}
                          </MapContainer>
                        </div>
                        <p className="text-xs text-gray-500 text-center">
                          🟢 Baslangic noktalari | 🔴 Bitis noktalari
                        </p>

                        {/* Trips Table */}
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Guzergah</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mesafe</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sure</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {trips.map((trip) => (
                                <tr key={trip.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-sm">
                                    <div className="flex items-center gap-1">
                                      <span className="text-green-600">{trip.start_province || '?'}</span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-red-600">{trip.end_province || (trip.ended_at ? '?' : '...')}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-600">
                                    {new Date(trip.started_at).toLocaleDateString('tr-TR')}
                                  </td>
                                  <td className="px-3 py-2 text-sm font-medium">
                                    {trip.distance_km?.toFixed(1) || 0} km
                                  </td>
                                  <td className="px-3 py-2 text-sm">
                                    {trip.duration_minutes ? `${Math.floor(trip.duration_minutes / 60)}s ${trip.duration_minutes % 60}dk` : '-'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant={trip.status === 'completed' ? 'success' : 'warning'} className="text-xs">
                                      {trip.status === 'completed' ? 'Bitti' : 'Aktif'}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon={TruckIcon}
                        title="Sefer kaydi yok"
                        description="Henuz sefer baslatilmamis. Sofor hareket ettiginde otomatik olarak sefer baslayacak."
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Communication Tab */}
            <TabsContent value="communication">
              <div className="space-y-6">
                {/* Feature Flag Warnings */}
                {(!driver.call_log_enabled || !driver.contacts_enabled) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-amber-800">Ozellik Kisitlamalari</h4>
                        <p className="text-sm text-amber-700 mt-1">
                          Bu surucu icin asagidaki ozellikler <strong>kapali</strong> durumda.
                          Senkronizasyon calisabilmesi icin Ayarlar sekmesinden ozellikleri acmaniz gerekir:
                        </p>
                        <ul className="text-sm text-amber-700 mt-2 space-y-1">
                          {!driver.call_log_enabled && (
                            <li className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                              Arama Gecmisi Erisimi: <strong>Kapali</strong>
                            </li>
                          )}
                          {!driver.contacts_enabled && (
                            <li className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                              Rehber Erisimi: <strong>Kapali</strong>
                            </li>
                          )}
                        </ul>
                        <Link
                          to="#"
                          onClick={() => setActiveTab('settings')}
                          className="inline-flex items-center gap-1 text-sm text-amber-800 font-medium mt-2 hover:underline"
                        >
                          <Cog6ToothIcon className="h-4 w-4" />
                          Ayarlara Git
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Call Logs */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <PhoneIcon className="h-5 w-5" />
                      Arama Gecmisi ({callLogs.length})
                      {!driver.call_log_enabled && (
                        <Badge variant="error" size="sm">Ozellik Kapali</Badge>
                      )}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!driver.call_log_enabled) {
                            toast.error('Arama gecmisi ozelligi bu surucu icin kapali. Ayarlar sekmesinden acin.')
                            return
                          }
                          requestCallLogSyncMutation.mutate()
                        }}
                        disabled={requestCallLogSyncMutation.isPending}
                        className={driver.call_log_enabled ? "text-blue-600" : "text-gray-400"}
                      >
                        {requestCallLogSyncMutation.isPending ? <LoadingSpinner size="sm" /> : '🔄 Senkronize Et'}
                      </Button>
                      {callLogs.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDeleteCallLogsConfirm(true)}
                          className="text-red-600"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Tumunu Sil
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {callLogsLoading ? (
                      <div className="flex justify-center py-8">
                        <LoadingSpinner />
                      </div>
                    ) : callLogs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numara</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kisi</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tip</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sure</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {callLogs.slice(0, 50).map((log) => (
                              <tr key={log.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium">{log.phone_number}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{log.contact_name || '-'}</td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant={
                                      log.call_type === 'incoming' ? 'success' :
                                      log.call_type === 'outgoing' ? 'info' :
                                      'error'
                                    }
                                    size="sm"
                                  >
                                    {log.call_type === 'incoming' ? 'Gelen' :
                                     log.call_type === 'outgoing' ? 'Giden' :
                                     log.call_type === 'missed' ? 'Cevapsiz' : log.call_type}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {Math.floor(log.duration_seconds / 60)}:{(log.duration_seconds % 60).toString().padStart(2, '0')}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {formatTurkeyDate(log.call_timestamp)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState
                        icon={PhoneIcon}
                        title="Arama gecmisi yok"
                        description="Henuz arama verisi gelmemis"
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Contacts */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <UserGroupIcon className="h-5 w-5" />
                      Rehber ({contacts.length})
                      {!driver.contacts_enabled && (
                        <Badge variant="error" size="sm">Ozellik Kapali</Badge>
                      )}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!driver.contacts_enabled) {
                            toast.error('Rehber ozelligi bu surucu icin kapali. Ayarlar sekmesinden acin.')
                            return
                          }
                          requestContactSyncMutation.mutate()
                        }}
                        disabled={requestContactSyncMutation.isPending}
                        className={driver.contacts_enabled ? "text-blue-600" : "text-gray-400"}
                      >
                        {requestContactSyncMutation.isPending ? <LoadingSpinner size="sm" /> : '🔄 Senkronize Et'}
                      </Button>
                      {contacts.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDeleteContactsConfirm(true)}
                          className="text-red-600"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Tumunu Sil
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {contactsLoading ? (
                      <div className="flex justify-center py-8">
                        <LoadingSpinner />
                      </div>
                    ) : contacts.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {contacts.slice(0, 50).map((contact) => (
                          <div key={contact.id} className="p-4 bg-gray-50 rounded-lg">
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            <div className="mt-1 space-y-1">
                              {Array.isArray(contact.phone_numbers) && contact.phone_numbers.map((phone, i) => (
                                <p key={i} className="text-sm text-gray-600">{phone}</p>
                              ))}
                            </div>
                            {contact.contact_type && (
                              <Badge variant="info" size="sm" className="mt-2">
                                {contact.contact_type}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={UserGroupIcon}
                        title="Rehber verisi yok"
                        description="Henuz rehber senkronize edilmemis"
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Responses Tab */}
            <TabsContent value="responses">
              {responsesLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Survey Responses */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Anket Cevaplari ({surveyResponses.length})</CardTitle>
                      {surveyResponses.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDeleteSurveyResponsesConfirm(true)}
                          className="text-red-600"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Tumunu Sil
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      {surveyResponses.length > 0 ? (
                        <div className="space-y-3">
                          {surveyResponses.map((response) => (
                            <div key={response.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium text-blue-800">{response.survey_title}</p>
                                <span className="text-xs text-blue-600">
                                  {new Date(response.created_at).toLocaleDateString('tr-TR')}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">{response.answer}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={ChatBubbleLeftRightIcon}
                          title="Anket cevabi yok"
                          description="Henuz anket cevaplamamis"
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* Question Responses */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Soru Cevaplari ({questionResponses.length})</CardTitle>
                      {questionResponses.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDeleteQuestionResponsesConfirm(true)}
                          className="text-red-600"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Tumunu Sil
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      {questionResponses.length > 0 ? (
                        <div className="space-y-3">
                          {questionResponses.map((response) => (
                            <div key={response.id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium text-green-800">{response.question_text}</p>
                                <Badge variant={response.status === 'answered' ? 'success' : 'warning'} size="sm">
                                  {response.status === 'answered' ? 'Cevaplandi' : 'Bekliyor'}
                                </Badge>
                              </div>
                              {response.answer_text && (
                                <p className="text-sm text-gray-700">{response.answer_text}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-2">
                                {response.answered_at
                                  ? `Cevap: ${formatTurkeyDate(response.answered_at)}`
                                  : `Olusturulma: ${formatTurkeyDate(response.created_at)}`}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          icon={ChatBubbleLeftRightIcon}
                          title="Soru cevabi yok"
                          description="Henuz soru cevaplamamis"
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Account Status */}
                <Card>
                  <CardHeader>
                    <CardTitle>Hesap Durumu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Hesap Aktif mi?</p>
                        <p className="text-sm text-gray-500">
                          {driver.is_active ? 'Hesap aktif, giris yapabilir' : 'Hesap pasif, giris yapamaz'}
                        </p>
                      </div>
                      <Button
                        variant={driver.is_active ? 'outline' : 'primary'}
                        onClick={() => updateStatusMutation.mutate(!driver.is_active)}
                        disabled={updateStatusMutation.isPending}
                      >
                        {updateStatusMutation.isPending ? (
                          <LoadingSpinner size="sm" />
                        ) : driver.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Feature Toggles */}
                <Card>
                  <CardHeader>
                    <CardTitle>Ozellik Kontrolleri</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { key: 'contacts_enabled', label: 'Rehber Erisimi', value: driver.contacts_enabled },
                        { key: 'call_log_enabled', label: 'Arama Gecmisi', value: driver.call_log_enabled },
                        { key: 'surveys_enabled', label: 'Anketler', value: driver.surveys_enabled },
                        { key: 'questions_enabled', label: 'Sorular', value: driver.questions_enabled },
                      ].map((feature) => (
                        <div key={feature.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-700">{feature.label}</span>
                          <button
                            onClick={() => updateFeaturesMutation.mutate({ [feature.key]: !feature.value })}
                            disabled={updateFeaturesMutation.isPending}
                            className={clsx(
                              'px-3 py-1 text-xs font-medium rounded transition-colors',
                              feature.value
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            )}
                          >
                            {feature.value ? 'Acik' : 'Kapali'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="lg:col-span-2 border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-600 flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5" />
                      Tehlikeli Bolge
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-sm text-red-600 mb-4">
                        Bu islem geri alinamaz! Surucuye ait tum veriler kalici olarak silinecektir.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <TrashIcon className="h-4 w-4 mr-2" />
                        Surucuyu Sil
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Home Creation Modal */}
      {showHomeModal && (
        <Modal isOpen onClose={() => setShowHomeModal(false)} title="Ev Adresi Ekle">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              Sofor ev bolgelerinden birine girdiginde sefer 30 dk icinde biter.
              Her soforun en fazla 2 ev adresi olabilir.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ev Adi</label>
              <input
                type="text"
                value={homeForm.name}
                onChange={(e) => setHomeForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Ev 1, Ana Ev, vb."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enlem (Latitude)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={homeForm.latitude || ''}
                  onChange={(e) => setHomeForm(f => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                  placeholder="41.015137"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Boylam (Longitude)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={homeForm.longitude || ''}
                  onChange={(e) => setHomeForm(f => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                  placeholder="28.979530"
                />
              </div>
            </div>

            {driver?.last_latitude && driver?.last_longitude && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setHomeForm(f => ({
                    ...f,
                    latitude: driver.last_latitude!,
                    longitude: driver.last_longitude!,
                  }))
                }}
              >
                <MapPinIcon className="h-4 w-4 mr-2" />
                Son Konumu Kullan ({driver.last_latitude?.toFixed(4)}, {driver.last_longitude?.toFixed(4)})
              </Button>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Il (Opsiyonel)</label>
                <input
                  type="text"
                  value={homeForm.province}
                  onChange={(e) => setHomeForm(f => ({ ...f, province: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Istanbul"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ilce (Opsiyonel)</label>
                <input
                  type="text"
                  value={homeForm.district}
                  onChange={(e) => setHomeForm(f => ({ ...f, district: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Kadikoy"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tespit Yaricapi (metre)</label>
              <input
                type="number"
                value={homeForm.radius}
                onChange={(e) => setHomeForm(f => ({ ...f, radius: parseInt(e.target.value) || 200 }))}
                min={50}
                max={1000}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">Sofor bu yarıçap içine girdiğinde "evde" sayılır</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowHomeModal(false)}>Iptal</Button>
            <Button
              onClick={handleCreateHome}
              disabled={!homeForm.name || !homeForm.latitude || !homeForm.longitude || createHomeMutation.isPending}
            >
              {createHomeMutation.isPending ? <LoadingSpinner size="sm" /> : 'Kaydet'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Edit Home Modal */}
      {editingHome && (
        <Modal isOpen onClose={() => setEditingHome(null)} title="Ev Adresini Duzenle">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ev Adi</label>
              <input
                type="text"
                value={editingHome.name}
                onChange={(e) => setEditingHome(h => h ? { ...h, name: e.target.value } : null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enlem</label>
                <input
                  type="number"
                  step="0.000001"
                  value={editingHome.latitude}
                  onChange={(e) => setEditingHome(h => h ? { ...h, latitude: parseFloat(e.target.value) || 0 } : null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Boylam</label>
                <input
                  type="number"
                  step="0.000001"
                  value={editingHome.longitude}
                  onChange={(e) => setEditingHome(h => h ? { ...h, longitude: parseFloat(e.target.value) || 0 } : null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yaricap (metre)</label>
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
              <label htmlFor="isActive" className="text-sm text-gray-700">Aktif (Pasif evler sefer bitisinde kullanilmaz)</label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditingHome(null)}>Iptal</Button>
            <Button
              onClick={() => {
                if (editingHome) {
                  updateHomeMutation.mutate({
                    homeId: editingHome.id,
                    data: {
                      name: editingHome.name,
                      latitude: editingHome.latitude,
                      longitude: editingHome.longitude,
                      radius: editingHome.radius,
                      is_active: editingHome.is_active
                    },
                  })
                }
              }}
              disabled={updateHomeMutation.isPending}
            >
              {updateHomeMutation.isPending ? <LoadingSpinner size="sm" /> : 'Guncelle'}
            </Button>
          </div>
        </Modal>
      )}


      {/* Delete Confirmations */}
      {showDeleteConfirm && (
        <Modal isOpen onClose={() => setShowDeleteConfirm(false)} title="Surucuyu Sil">
          <div className="mb-6">
            <p className="text-gray-600 mb-2">
              <strong>{driver?.name} {driver?.surname}</strong> adli surucuyu silmek istediginize emin misiniz?
            </p>
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              Bu islem geri alinamaz! Tum veriler silinecektir.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Iptal</Button>
            <Button
              onClick={() => {
                deleteDriverMutation.mutate()
                setShowDeleteConfirm(false)
              }}
              disabled={deleteDriverMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteDriverMutation.isPending ? <LoadingSpinner size="sm" /> : 'Evet, Sil'}
            </Button>
          </div>
        </Modal>
      )}

      {showDeleteCallLogsConfirm && (
        <Modal isOpen onClose={() => setShowDeleteCallLogsConfirm(false)} title="Arama Gecmisini Sil">
          <div className="mb-6">
            <p className="text-gray-600">Tum arama gecmisini silmek istediginize emin misiniz?</p>
            <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg mt-2">
              Toplam {callLogs.length} arama kaydi silinecektir.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteCallLogsConfirm(false)}>Iptal</Button>
            <Button
              onClick={() => deleteCallLogsMutation.mutate()}
              disabled={deleteCallLogsMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteCallLogsMutation.isPending ? <LoadingSpinner size="sm" /> : 'Evet, Sil'}
            </Button>
          </div>
        </Modal>
      )}

      {showDeleteContactsConfirm && (
        <Modal isOpen onClose={() => setShowDeleteContactsConfirm(false)} title="Rehberi Sil">
          <div className="mb-6">
            <p className="text-gray-600">Tum rehber verilerini silmek istediginize emin misiniz?</p>
            <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg mt-2">
              Toplam {contacts.length} kisi silinecektir.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteContactsConfirm(false)}>Iptal</Button>
            <Button
              onClick={() => deleteContactsMutation.mutate()}
              disabled={deleteContactsMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteContactsMutation.isPending ? <LoadingSpinner size="sm" /> : 'Evet, Sil'}
            </Button>
          </div>
        </Modal>
      )}

      {showDeleteSurveyResponsesConfirm && (
        <Modal isOpen onClose={() => setShowDeleteSurveyResponsesConfirm(false)} title="Anket Cevaplarini Sil">
          <div className="mb-6">
            <p className="text-gray-600">Tum anket cevaplarini silmek istediginize emin misiniz?</p>
            <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg mt-2">
              Toplam {surveyResponses.length} anket cevabi silinecektir.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteSurveyResponsesConfirm(false)}>Iptal</Button>
            <Button
              onClick={() => deleteSurveyResponsesMutation.mutate()}
              disabled={deleteSurveyResponsesMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteSurveyResponsesMutation.isPending ? <LoadingSpinner size="sm" /> : 'Evet, Sil'}
            </Button>
          </div>
        </Modal>
      )}

      {showDeleteQuestionResponsesConfirm && (
        <Modal isOpen onClose={() => setShowDeleteQuestionResponsesConfirm(false)} title="Soru Cevaplarini Sil">
          <div className="mb-6">
            <p className="text-gray-600">Tum soru cevaplarini silmek istediginize emin misiniz?</p>
            <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg mt-2">
              Toplam {questionResponses.length} soru cevabi silinecektir.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteQuestionResponsesConfirm(false)}>Iptal</Button>
            <Button
              onClick={() => deleteQuestionResponsesMutation.mutate()}
              disabled={deleteQuestionResponsesMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteQuestionResponsesMutation.isPending ? <LoadingSpinner size="sm" /> : 'Evet, Sil'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
