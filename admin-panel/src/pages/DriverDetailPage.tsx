import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { driversApi, notificationsApi } from '../services/api'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import {
  ArrowLeftIcon,
  TruckIcon,
  MapPinIcon,
  ClockIcon,
  BellIcon,
  ChartBarIcon,
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

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [notifTitle, setNotifTitle] = useState('')
  const [notifBody, setNotifBody] = useState('')
  const [sendingNotif, setSendingNotif] = useState(false)

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

  const driver: Driver | null = driverData?.data || null
  const locations: Location[] = locationsData?.data?.locations || []
  const trips: Trip[] = tripsData?.data?.trips || []

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
              <dt className="text-sm text-gray-500">Ev Adresi</dt>
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
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPinIcon className="h-5 w-5" />
          Konum Geçmişi
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
            {routeCoords.length > 1 && (
              <Polyline positions={routeCoords} color="blue" weight={3} opacity={0.7} />
            )}
          </MapContainer>
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
                    Bitiş
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
                      {trip.end_time
                        ? new Date(trip.end_time).toLocaleString('tr-TR')
                        : '-'}
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
  )
}
