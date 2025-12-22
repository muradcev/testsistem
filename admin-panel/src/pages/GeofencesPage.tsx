import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { geofencesApi } from '../services/api'
import toast from 'react-hot-toast'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents } from 'react-leaflet'
import {
  MapPinIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Modal,
  LoadingSpinner,
  Badge,
} from '../components/ui'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface Geofence {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
  created_at: string
  updated_at?: string
}

const geofenceTypes = [
  { id: 'warehouse', name: 'Depo', color: '#3b82f6' },
  { id: 'customer', name: 'Musteri', color: '#22c55e' },
  { id: 'port', name: 'Liman', color: '#8b5cf6' },
  { id: 'factory', name: 'Fabrika', color: '#f59e0b' },
  { id: 'rest_area', name: 'Dinlenme Alani', color: '#6b7280' },
  { id: 'border', name: 'Sinir Kapisi', color: '#ef4444' },
]

function LocationPicker({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function GeofencesPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'warehouse',
    latitude: 39.925533,
    longitude: 32.866287,
    radius_meters: 500,
    is_active: true,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['geofences'],
    queryFn: () => geofencesApi.getAll(),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => geofencesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] })
      toast.success('Bolge olusturuldu')
      closeModal()
    },
    onError: () => toast.error('Olusturulamadi'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      geofencesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] })
      toast.success('Bolge guncellendi')
      closeModal()
    },
    onError: () => toast.error('Guncellenemedi'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => geofencesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] })
      toast.success('Bolge silindi')
    },
    onError: () => toast.error('Silinemedi'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      geofencesApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] })
      toast.success('Durum guncellendi')
    },
    onError: () => toast.error('Guncellenemedi'),
  })

  const geofences: Geofence[] = data?.data?.zones || []

  const closeModal = () => {
    setShowModal(false)
    setEditingGeofence(null)
    setFormData({
      name: '',
      type: 'warehouse',
      latitude: 39.925533,
      longitude: 32.866287,
      radius_meters: 500,
      is_active: true,
    })
  }

  const openCreateModal = () => {
    setEditingGeofence(null)
    setFormData({
      name: '',
      type: 'warehouse',
      latitude: 39.925533,
      longitude: 32.866287,
      radius_meters: 500,
      is_active: true,
    })
    setShowModal(true)
  }

  const openEditModal = (geofence: Geofence) => {
    setEditingGeofence(geofence)
    setFormData({
      name: geofence.name,
      type: geofence.type,
      latitude: geofence.latitude,
      longitude: geofence.longitude,
      radius_meters: geofence.radius_meters,
      is_active: geofence.is_active,
    })
    setShowModal(true)
  }

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('Bolge adi gerekli')
      return
    }
    if (editingGeofence) {
      updateMutation.mutate({ id: editingGeofence.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const getTypeInfo = (type: string) => {
    return geofenceTypes.find(t => t.id === type) || { id: type, name: type, color: '#6b7280' }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Geofence Bolgeleri</h1>
          <p className="text-gray-500 mt-1">Soforlerin girdigi/ciktigi bolgeleri yonetin</p>
        </div>
        <Button onClick={openCreateModal}>
          <PlusIcon className="h-5 w-5 mr-2" />
          Yeni Bolge
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPinIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Toplam Bolge</p>
                <p className="text-2xl font-bold">{geofences.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Aktif</p>
                <p className="text-2xl font-bold">{geofences.filter(g => g.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <XCircleIcon className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pasif</p>
                <p className="text-2xl font-bold">{geofences.filter(g => !g.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1">
              {geofenceTypes.slice(0, 4).map(type => (
                <span
                  key={type.id}
                  className="px-2 py-1 text-xs rounded"
                  style={{ backgroundColor: `${type.color}20`, color: type.color }}
                >
                  {type.name}: {geofences.filter(g => g.type === type.id).length}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map & List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map */}
        <Card>
          <CardHeader>
            <CardTitle>Harita Gorunumu</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[500px] rounded-b-lg overflow-hidden">
              <MapContainer
                center={[39.0, 35.0]}
                zoom={6}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {geofences.map(geofence => {
                  const typeInfo = getTypeInfo(geofence.type)
                  return (
                    <div key={geofence.id}>
                      <Circle
                        center={[geofence.latitude, geofence.longitude]}
                        radius={geofence.radius_meters}
                        pathOptions={{
                          color: geofence.is_active ? typeInfo.color : '#9ca3af',
                          fillColor: geofence.is_active ? typeInfo.color : '#9ca3af',
                          fillOpacity: 0.3,
                        }}
                      >
                        <Popup>
                          <div className="text-sm">
                            <strong>{geofence.name}</strong>
                            <br />
                            <span className="text-gray-500">{typeInfo.name}</span>
                            <br />
                            <span className="text-gray-500">{geofence.radius_meters}m yaricap</span>
                            <br />
                            <span className={geofence.is_active ? 'text-green-600' : 'text-gray-500'}>
                              {geofence.is_active ? 'Aktif' : 'Pasif'}
                            </span>
                          </div>
                        </Popup>
                      </Circle>
                      <Marker position={[geofence.latitude, geofence.longitude]}>
                        <Popup>{geofence.name}</Popup>
                      </Marker>
                    </div>
                  )
                })}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle>Bolge Listesi ({geofences.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[440px] overflow-y-auto">
              {geofences.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Henuz bolge eklenmemis</p>
              ) : (
                geofences.map(geofence => {
                  const typeInfo = getTypeInfo(geofence.type)
                  return (
                    <div
                      key={geofence.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: geofence.is_active ? typeInfo.color : '#9ca3af' }}
                        />
                        <div>
                          <p className="font-medium">{geofence.name}</p>
                          <p className="text-xs text-gray-500">
                            {typeInfo.name} | {geofence.radius_meters}m
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={geofence.is_active ? 'success' : 'default'} className="text-xs">
                          {geofence.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                        <button
                          onClick={() => toggleMutation.mutate({ id: geofence.id, is_active: !geofence.is_active })}
                          className="p-1 hover:bg-gray-200 rounded"
                          title={geofence.is_active ? 'Pasif Yap' : 'Aktif Yap'}
                        >
                          {geofence.is_active ? (
                            <XCircleIcon className="h-4 w-4 text-gray-500" />
                          ) : (
                            <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(geofence)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Duzenle"
                        >
                          <PencilIcon className="h-4 w-4 text-blue-500" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`"${geofence.name}" bolgesini silmek istediginize emin misiniz?`)) {
                              deleteMutation.mutate(geofence.id)
                            }
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Sil"
                        >
                          <TrashIcon className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          isOpen
          onClose={closeModal}
          title={editingGeofence ? 'Bolge Duzenle' : 'Yeni Bolge Ekle'}
        >
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bolge Adi</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Istanbul Depo"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bolge Tipi</label>
              <select
                value={formData.type}
                onChange={e => setFormData(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {geofenceTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enlem</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.latitude}
                  onChange={e => setFormData(f => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Boylam</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.longitude}
                  onChange={e => setFormData(f => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                />
              </div>
            </div>

            {/* Mini Map for location selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Haritadan Sec (tikla)</label>
              <div className="h-48 rounded-lg overflow-hidden border">
                <MapContainer
                  center={[formData.latitude, formData.longitude]}
                  zoom={10}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationPicker
                    onLocationSelect={(lat, lng) => setFormData(f => ({ ...f, latitude: lat, longitude: lng }))}
                  />
                  <Marker position={[formData.latitude, formData.longitude]} />
                  <Circle
                    center={[formData.latitude, formData.longitude]}
                    radius={formData.radius_meters}
                    pathOptions={{ color: getTypeInfo(formData.type).color, fillOpacity: 0.2 }}
                  />
                </MapContainer>
              </div>
            </div>

            {/* Radius */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yaricap: {formData.radius_meters}m
              </label>
              <input
                type="range"
                min={100}
                max={5000}
                step={100}
                value={formData.radius_meters}
                onChange={e => setFormData(f => ({ ...f, radius_meters: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>100m</span>
                <span>5000m</span>
              </div>
            </div>

            {/* Active */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={e => setFormData(f => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 text-primary-600 rounded"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">Aktif</label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={closeModal}>Iptal</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <LoadingSpinner size="sm" />
              ) : (
                editingGeofence ? 'Guncelle' : 'Olustur'
              )}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
