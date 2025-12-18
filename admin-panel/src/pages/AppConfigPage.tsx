import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  TruckIcon,
  CubeIcon,
  TagIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import api from '../services/api'

interface CargoType {
  id: string
  name: string
  description: string
  icon: string
  is_active: boolean
  sort_order: number
}

interface VehicleBrand {
  id: string
  name: string
  is_active: boolean
  sort_order: number
  models: VehicleModel[]
}

interface VehicleModel {
  id: string
  brand_id: string
  name: string
  is_active: boolean
}

interface TrailerType {
  id: string
  name: string
  description: string
  is_active: boolean
  sort_order: number
}

interface MobileConfig {
  location_update_interval_moving: number
  location_update_interval_stationary: number
  minimum_displacement_meters: number
  fast_moving_threshold_kmh: number
  fast_moving_interval_seconds: number
  battery_optimization_enabled: boolean
  location_accuracy_mode: string
  low_battery_threshold: number
  low_battery_interval_seconds: number
  offline_mode_enabled: boolean
  max_offline_locations: number
  offline_sync_interval_minutes: number
  sync_on_wifi_only: boolean
  max_offline_data_size_mb: number
  activity_recognition_enabled: boolean
  stop_detection_enabled: boolean
  stop_detection_radius_meters: number
  stop_detection_min_minutes: number
  heartbeat_interval_minutes: number
  data_retention_days: number
  min_app_version: string
  force_update_enabled: boolean
}

type ConfigTab = 'cargo' | 'vehicles' | 'trailers' | 'mobile'

export default function AppConfigPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ConfigTab>('cargo')
  const [editModal, setEditModal] = useState<{
    type: ConfigTab
    item: any
  } | null>(null)
  const [modelModal, setModelModal] = useState<{ brandId: string; model?: VehicleModel } | null>(null)

  // Queries
  const { data: cargoData } = useQuery({
    queryKey: ['cargo-types'],
    queryFn: () => api.get('/admin/config/cargo-types'),
  })

  const { data: vehicleData } = useQuery({
    queryKey: ['vehicle-brands'],
    queryFn: () => api.get('/admin/config/vehicle-brands'),
  })

  const { data: trailerData } = useQuery({
    queryKey: ['trailer-types'],
    queryFn: () => api.get('/admin/config/trailer-types'),
  })

  const { data: mobileConfigData } = useQuery({
    queryKey: ['mobile-config'],
    queryFn: () => api.get('/admin/config/mobile'),
  })

  const cargoTypes: CargoType[] = cargoData?.data?.cargo_types || []
  const vehicleBrands: VehicleBrand[] = vehicleData?.data?.vehicle_brands || []
  const trailerTypes: TrailerType[] = trailerData?.data?.trailer_types || []
  const mobileConfig: MobileConfig | null = mobileConfigData?.data || null

  // Mutations
  const cargoMutation = useMutation({
    mutationFn: (data: { id?: string; item: Partial<CargoType>; action: 'create' | 'update' | 'delete' }) => {
      if (data.action === 'delete') {
        return api.delete(`/admin/config/cargo-types/${data.id}`)
      }
      if (data.id) {
        return api.put(`/admin/config/cargo-types/${data.id}`, data.item)
      }
      return api.post('/admin/config/cargo-types', data.item)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo-types'] })
      toast.success('Kaydedildi')
      setEditModal(null)
    },
    onError: () => toast.error('Hata oluştu'),
  })

  const vehicleBrandMutation = useMutation({
    mutationFn: (data: { id?: string; item: Partial<VehicleBrand>; action: 'create' | 'update' | 'delete' }) => {
      if (data.action === 'delete') {
        return api.delete(`/admin/config/vehicle-brands/${data.id}`)
      }
      if (data.id) {
        return api.put(`/admin/config/vehicle-brands/${data.id}`, data.item)
      }
      return api.post('/admin/config/vehicle-brands', data.item)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-brands'] })
      toast.success('Kaydedildi')
      setEditModal(null)
    },
    onError: () => toast.error('Hata oluştu'),
  })

  const vehicleModelMutation = useMutation({
    mutationFn: (data: { brandId: string; id?: string; item: Partial<VehicleModel>; action: 'create' | 'update' | 'delete' }) => {
      if (data.action === 'delete') {
        return api.delete(`/admin/config/vehicle-models/${data.id}`)
      }
      if (data.id) {
        return api.put(`/admin/config/vehicle-models/${data.id}`, data.item)
      }
      return api.post(`/admin/config/vehicle-brands/${data.brandId}/models`, data.item)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-brands'] })
      toast.success('Kaydedildi')
      setModelModal(null)
    },
    onError: () => toast.error('Hata oluştu'),
  })

  const trailerMutation = useMutation({
    mutationFn: (data: { id?: string; item: Partial<TrailerType>; action: 'create' | 'update' | 'delete' }) => {
      if (data.action === 'delete') {
        return api.delete(`/admin/config/trailer-types/${data.id}`)
      }
      if (data.id) {
        return api.put(`/admin/config/trailer-types/${data.id}`, data.item)
      }
      return api.post('/admin/config/trailer-types', data.item)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trailer-types'] })
      toast.success('Kaydedildi')
      setEditModal(null)
    },
    onError: () => toast.error('Hata oluştu'),
  })

  const mobileConfigMutation = useMutation({
    mutationFn: (data: MobileConfig) => api.put('/admin/config/mobile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-config'] })
      toast.success('Mobil ayarlar kaydedildi')
    },
    onError: () => toast.error('Mobil ayarlar kaydedilemedi'),
  })

  const handleDelete = (type: ConfigTab, id: string) => {
    if (!window.confirm('Silmek istediğinize emin misiniz?')) return

    if (type === 'cargo') {
      cargoMutation.mutate({ id, item: {}, action: 'delete' })
    } else if (type === 'vehicles') {
      vehicleBrandMutation.mutate({ id, item: {}, action: 'delete' })
    } else {
      trailerMutation.mutate({ id, item: {}, action: 'delete' })
    }
  }

  const tabs = [
    { id: 'cargo' as ConfigTab, label: 'Yük Tipleri', icon: CubeIcon, count: cargoTypes.length },
    { id: 'vehicles' as ConfigTab, label: 'Araç Markaları', icon: TruckIcon, count: vehicleBrands.length },
    { id: 'trailers' as ConfigTab, label: 'Dorse Tipleri', icon: TagIcon, count: trailerTypes.length },
    { id: 'mobile' as ConfigTab, label: 'Mobil Ayarlar', icon: DevicePhoneMobileIcon },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Uygulama Ayarları</h1>
        <p className="text-sm sm:text-base text-gray-500">
          Mobil uygulamada görüntülenecek seçenekleri yönetin
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex space-x-4 sm:space-x-8 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              {tab.count !== undefined && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Cargo Types */}
      {activeTab === 'cargo' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="font-semibold">Yük Tipleri</h2>
            <button
              onClick={() => setEditModal({ type: 'cargo', item: {} })}
              className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 w-full sm:w-auto"
            >
              <PlusIcon className="h-5 w-5" />
              Yeni Ekle
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Sıra
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Açıklama
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  İkon
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cargoTypes.map((type) => (
                <tr key={type.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{type.sort_order}</td>
                  <td className="px-6 py-4 text-sm font-medium">{type.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{type.description}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{type.icon}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setEditModal({ type: 'cargo', item: type })}
                      className="text-gray-500 hover:text-primary-600 p-1"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete('cargo', type.id)}
                      className="text-gray-500 hover:text-red-600 p-1 ml-2"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Vehicle Brands */}
      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="font-semibold">Araç Markaları</h2>
              <button
                onClick={() => setEditModal({ type: 'vehicles', item: {} })}
                className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 w-full sm:w-auto"
              >
                <PlusIcon className="h-5 w-5" />
                Yeni Marka
              </button>
            </div>

            {vehicleBrands.map((brand) => (
              <div key={brand.id} className="border-b last:border-b-0">
                <div className="p-4 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-3">
                    <TruckIcon className="h-5 w-5 text-gray-400" />
                    <span className="font-medium">{brand.name}</span>
                    <span className="text-xs text-gray-500">
                      ({brand.models?.length || 0} model)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setModelModal({ brandId: brand.id })}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      + Model Ekle
                    </button>
                    <button
                      onClick={() => setEditModal({ type: 'vehicles', item: brand })}
                      className="text-gray-500 hover:text-primary-600 p-1"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete('vehicles', brand.id)}
                      className="text-gray-500 hover:text-red-600 p-1"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {brand.models && brand.models.length > 0 && (
                  <div className="p-4 pl-12 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {brand.models.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between bg-gray-100 rounded px-3 py-1"
                      >
                        <span className="text-sm">{model.name}</span>
                        <div className="flex items-center">
                          <button
                            onClick={() => setModelModal({ brandId: brand.id, model })}
                            className="text-gray-400 hover:text-primary-600 p-1"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Modeli silmek istiyor musunuz?')) {
                                vehicleModelMutation.mutate({
                                  brandId: brand.id,
                                  id: model.id,
                                  item: {},
                                  action: 'delete',
                                })
                              }
                            }}
                            className="text-gray-400 hover:text-red-600 p-1"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trailer Types */}
      {activeTab === 'trailers' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="font-semibold">Dorse Tipleri</h2>
            <button
              onClick={() => setEditModal({ type: 'trailers', item: {} })}
              className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 w-full sm:w-auto"
            >
              <PlusIcon className="h-5 w-5" />
              Yeni Ekle
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Sıra
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Açıklama
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {trailerTypes.map((type) => (
                <tr key={type.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{type.sort_order}</td>
                  <td className="px-6 py-4 text-sm font-medium">{type.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{type.description}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setEditModal({ type: 'trailers', item: type })}
                      className="text-gray-500 hover:text-primary-600 p-1"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete('trailers', type.id)}
                      className="text-gray-500 hover:text-red-600 p-1 ml-2"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Mobile Config */}
      {activeTab === 'mobile' && mobileConfig && (
        <MobileConfigForm
          config={mobileConfig}
          onSave={(config) => mobileConfigMutation.mutate(config)}
          isLoading={mobileConfigMutation.isPending}
        />
      )}

      {/* Edit Modal */}
      {editModal && (
        <EditModal
          type={editModal.type}
          item={editModal.item}
          onClose={() => setEditModal(null)}
          onSave={(item) => {
            const action = item.id ? 'update' : 'create'
            if (editModal.type === 'cargo') {
              cargoMutation.mutate({ id: item.id, item, action })
            } else if (editModal.type === 'vehicles') {
              vehicleBrandMutation.mutate({ id: item.id, item, action })
            } else {
              trailerMutation.mutate({ id: item.id, item, action })
            }
          }}
        />
      )}

      {/* Model Modal */}
      {modelModal && (
        <ModelModal
          brandId={modelModal.brandId}
          model={modelModal.model}
          onClose={() => setModelModal(null)}
          onSave={(item) => {
            vehicleModelMutation.mutate({
              brandId: modelModal.brandId,
              id: modelModal.model?.id,
              item,
              action: modelModal.model ? 'update' : 'create',
            })
          }}
        />
      )}
    </div>
  )
}

// Edit Modal Component
function EditModal({
  type,
  item,
  onClose,
  onSave,
}: {
  type: ConfigTab
  item: any
  onClose: () => void
  onSave: (item: any) => void
}) {
  const [formData, setFormData] = useState({
    name: item.name || '',
    description: item.description || '',
    icon: item.icon || '',
    sort_order: item.sort_order || 0,
    is_active: item.is_active ?? true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ ...formData, id: item.id })
  }

  const title =
    type === 'cargo'
      ? item.id
        ? 'Yük Tipi Düzenle'
        : 'Yeni Yük Tipi'
      : type === 'vehicles'
      ? item.id
        ? 'Marka Düzenle'
        : 'Yeni Marka'
      : item.id
      ? 'Dorse Tipi Düzenle'
      : 'Yeni Dorse Tipi'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end sm:items-center justify-center min-h-screen sm:px-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
        <div className="relative bg-white rounded-t-2xl sm:rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ad
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            {type !== 'vehicles' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            )}

            {type === 'cargo' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  İkon
                </label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, icon: e.target.value }))
                  }
                  placeholder="food, construction, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sıra
              </label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sort_order: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Model Modal Component
function ModelModal({
  brandId: _brandId,
  model,
  onClose,
  onSave,
}: {
  brandId: string
  model?: VehicleModel
  onClose: () => void
  onSave: (item: any) => void
}) {
  void _brandId // Suppress unused variable warning
  const [name, setName] = useState(model?.name || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ name, is_active: true })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end sm:items-center justify-center min-h-screen sm:px-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
        <div className="relative bg-white rounded-t-2xl sm:rounded-lg shadow-xl max-w-sm w-full p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {model ? 'Model Düzenle' : 'Yeni Model'}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model Adı
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Actros, FH16, etc."
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Mobile Config Form Component
function MobileConfigForm({
  config,
  onSave,
  isLoading,
}: {
  config: MobileConfig
  onSave: (config: MobileConfig) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<MobileConfig>(config)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const updateField = (field: keyof MobileConfig, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Konum Güncelleme Ayarları */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Konum Güncelleme Ayarları</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hareket Güncelleme Aralığı (sn)
            </label>
            <input
              type="number"
              value={formData.location_update_interval_moving}
              onChange={(e) => updateField('location_update_interval_moving', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Hareket halindeyken konum güncelleme sıklığı</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sabit Güncelleme Aralığı (sn)
            </label>
            <input
              type="number"
              value={formData.location_update_interval_stationary}
              onChange={(e) => updateField('location_update_interval_stationary', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Durunca konum güncelleme sıklığı</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Yer Değişikliği (m)
            </label>
            <input
              type="number"
              value={formData.minimum_displacement_meters}
              onChange={(e) => updateField('minimum_displacement_meters', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Konum güncellemesi için minimum hareket mesafesi</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hızlı Hareket Eşiği (km/sa)
            </label>
            <input
              type="number"
              value={formData.fast_moving_threshold_kmh}
              onChange={(e) => updateField('fast_moving_threshold_kmh', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Bu hızın üzerinde daha sık güncelleme</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hızlı Hareket Aralığı (sn)
            </label>
            <input
              type="number"
              value={formData.fast_moving_interval_seconds}
              onChange={(e) => updateField('fast_moving_interval_seconds', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Hızlı harekette güncelleme sıklığı</p>
          </div>
        </div>
      </div>

      {/* Pil Optimizasyonu Ayarları */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Pil Optimizasyonu</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="battery_optimization"
              checked={formData.battery_optimization_enabled}
              onChange={(e) => updateField('battery_optimization_enabled', e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded border-gray-300"
            />
            <label htmlFor="battery_optimization" className="ml-2 text-sm font-medium text-gray-700">
              Pil Optimizasyonu Aktif
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Konum Hassasiyeti
            </label>
            <select
              value={formData.location_accuracy_mode}
              onChange={(e) => updateField('location_accuracy_mode', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="high">Yüksek (GPS)</option>
              <option value="balanced">Dengeli (GPS + Ağ)</option>
              <option value="low_power">Düşük Güç (Ağ)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Düşük Pil Eşiği (%)
            </label>
            <input
              type="number"
              min="5"
              max="50"
              value={formData.low_battery_threshold}
              onChange={(e) => updateField('low_battery_threshold', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Düşük Pil Aralığı (sn)
            </label>
            <input
              type="number"
              value={formData.low_battery_interval_seconds}
              onChange={(e) => updateField('low_battery_interval_seconds', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Düşük pilde güncelleme sıklığı</p>
          </div>
        </div>
      </div>

      {/* Offline Mod Ayarları */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Offline Mod</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="offline_mode"
              checked={formData.offline_mode_enabled}
              onChange={(e) => updateField('offline_mode_enabled', e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded border-gray-300"
            />
            <label htmlFor="offline_mode" className="ml-2 text-sm font-medium text-gray-700">
              Offline Mod Aktif
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="sync_wifi"
              checked={formData.sync_on_wifi_only}
              onChange={(e) => updateField('sync_on_wifi_only', e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded border-gray-300"
            />
            <label htmlFor="sync_wifi" className="ml-2 text-sm font-medium text-gray-700">
              Sadece WiFi'da Senkronize Et
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maks. Offline Konum Sayısı
            </label>
            <input
              type="number"
              value={formData.max_offline_locations}
              onChange={(e) => updateField('max_offline_locations', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sync Aralığı (dk)
            </label>
            <input
              type="number"
              value={formData.offline_sync_interval_minutes}
              onChange={(e) => updateField('offline_sync_interval_minutes', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maks. Offline Veri (MB)
            </label>
            <input
              type="number"
              value={formData.max_offline_data_size_mb}
              onChange={(e) => updateField('max_offline_data_size_mb', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Aktivite Algılama */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Aktivite Algılama</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="activity_recognition"
              checked={formData.activity_recognition_enabled}
              onChange={(e) => updateField('activity_recognition_enabled', e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded border-gray-300"
            />
            <label htmlFor="activity_recognition" className="ml-2 text-sm font-medium text-gray-700">
              Aktivite Algılama Aktif
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="stop_detection"
              checked={formData.stop_detection_enabled}
              onChange={(e) => updateField('stop_detection_enabled', e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded border-gray-300"
            />
            <label htmlFor="stop_detection" className="ml-2 text-sm font-medium text-gray-700">
              Durak Algılama Aktif
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durak Algılama Yarıçapı (m)
            </label>
            <input
              type="number"
              value={formData.stop_detection_radius_meters}
              onChange={(e) => updateField('stop_detection_radius_meters', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min. Durak Süresi (dk)
            </label>
            <input
              type="number"
              value={formData.stop_detection_min_minutes}
              onChange={(e) => updateField('stop_detection_min_minutes', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Genel Ayarlar */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Genel Ayarlar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heartbeat Aralığı (dk)
            </label>
            <input
              type="number"
              value={formData.heartbeat_interval_minutes}
              onChange={(e) => updateField('heartbeat_interval_minutes', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Uygulama aktiflik kontrolü sıklığı</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Veri Saklama Süresi (gün)
            </label>
            <input
              type="number"
              value={formData.data_retention_days}
              onChange={(e) => updateField('data_retention_days', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Uygulama Versiyonu
            </label>
            <input
              type="text"
              value={formData.min_app_version}
              onChange={(e) => updateField('min_app_version', e.target.value)}
              placeholder="1.0.0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="force_update"
              checked={formData.force_update_enabled}
              onChange={(e) => updateField('force_update_enabled', e.target.checked)}
              className="h-4 w-4 text-primary-600 rounded border-gray-300"
            />
            <label htmlFor="force_update" className="ml-2 text-sm font-medium text-gray-700">
              Zorunlu Güncelleme Aktif
            </label>
          </div>
        </div>
      </div>

      {/* Kaydet Butonu */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
        </button>
      </div>
    </form>
  )
}
