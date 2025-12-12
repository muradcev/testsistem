import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, notificationsApi } from '../services/api'
import toast from 'react-hot-toast'
import { Cog6ToothIcon, BellIcon } from '@heroicons/react/24/outline'

interface Settings {
  sms_enabled: string
  sms_provider: string
  sms_api_key: string
  sms_api_secret: string
  location_interval_active: string
  location_interval_idle: string
  location_interval_trip: string
  trip_start_speed_threshold: string
  trip_end_idle_minutes: string
  home_radius_meters: string
  [key: string]: string
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<Settings>({
    sms_enabled: 'false',
    sms_provider: 'netgsm',
    sms_api_key: '',
    sms_api_secret: '',
    location_interval_active: '30',
    location_interval_idle: '300',
    location_interval_trip: '10',
    trip_start_speed_threshold: '15',
    trip_end_idle_minutes: '15',
    home_radius_meters: '200',
  })

  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll(),
  })

  useEffect(() => {
    if (data?.data?.settings) {
      setSettings((prev) => ({
        ...prev,
        ...data.data.settings,
      }))
    }
  }, [data])

  const updateMutation = useMutation({
    mutationFn: (settings: Record<string, string>) => settingsApi.update(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Ayarlar kaydedildi')
    },
    onError: () => toast.error('Ayarlar kaydedilemedi'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(settings)
  }

  const handleBroadcast = async () => {
    if (!broadcastTitle || !broadcastBody) {
      toast.error('Başlık ve içerik gerekli')
      return
    }

    setSendingBroadcast(true)
    try {
      await notificationsApi.broadcast({
        title: broadcastTitle,
        body: broadcastBody,
      })
      toast.success('Toplu bildirim gönderildi')
      setBroadcastTitle('')
      setBroadcastBody('')
    } catch {
      toast.error('Bildirim gönderilemedi')
    } finally {
      setSendingBroadcast(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ayarlar</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* General Settings */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Cog6ToothIcon className="h-5 w-5" />
            Genel Ayarlar
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* SMS Settings */}
            <div className="border-b pb-3 sm:pb-4 mb-3 sm:mb-4">
              <h3 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">SMS Ayarları</h3>

              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="sms_enabled"
                  checked={settings.sms_enabled === 'true'}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      sms_enabled: e.target.checked ? 'true' : 'false',
                    }))
                  }
                  className="rounded border-gray-300 text-primary-600"
                />
                <label htmlFor="sms_enabled" className="text-sm text-gray-700">
                  SMS Doğrulama Aktif
                </label>
              </div>

              {settings.sms_enabled === 'true' && (
                <>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMS Sağlayıcı
                    </label>
                    <select
                      value={settings.sms_provider}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          sms_provider: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="netgsm">NetGSM</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="text"
                      value={settings.sms_api_key}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          sms_api_key: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Secret
                    </label>
                    <input
                      type="password"
                      value={settings.sms_api_secret}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          sms_api_secret: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Location Settings */}
            <div className="border-b pb-3 sm:pb-4 mb-3 sm:mb-4">
              <h3 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Konum Ayarları</h3>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aktif Aralığı (sn)
                  </label>
                  <input
                    type="number"
                    value={settings.location_interval_active}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        location_interval_active: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beklemede Aralığı (sn)
                  </label>
                  <input
                    type="number"
                    value={settings.location_interval_idle}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        location_interval_idle: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sefer Aralığı (sn)
                  </label>
                  <input
                    type="number"
                    value={settings.location_interval_trip}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        location_interval_trip: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ev Yarıçapı (m)
                  </label>
                  <input
                    type="number"
                    value={settings.home_radius_meters}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        home_radius_meters: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Trip Settings */}
            <div className="mb-3 sm:mb-4">
              <h3 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Sefer Ayarları</h3>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Başlama Hız Eşiği (km/s)
                  </label>
                  <input
                    type="number"
                    value={settings.trip_start_speed_threshold}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        trip_start_speed_threshold: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bitiş Bekleme Süresi (dk)
                  </label>
                  <input
                    type="number"
                    value={settings.trip_end_idle_minutes}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        trip_end_idle_minutes: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </form>
        </div>

        {/* Broadcast Notification */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <BellIcon className="h-5 w-5" />
            Toplu Bildirim Gönder
          </h2>

          <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
            Tüm aktif şoförlere aynı anda bildirim gönderin.
          </p>

          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlık
              </label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Bildirim başlığı"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İçerik
              </label>
              <textarea
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Bildirim içeriği"
              />
            </div>

            <button
              onClick={handleBroadcast}
              disabled={sendingBroadcast}
              className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {sendingBroadcast ? 'Gönderiliyor...' : 'Tüm Şoförlere Gönder'}
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
        <h3 className="font-medium text-blue-900 mb-2 text-sm sm:text-base">Ayar Açıklamaları</h3>
        <ul className="text-xs sm:text-sm text-blue-800 space-y-1">
          <li>
            <strong>Aktif Aralığı:</strong> Şoför aktif olduğunda konum gönderme sıklığı
          </li>
          <li>
            <strong>Beklemede Aralığı:</strong> Şoför hareketsizken konum gönderme sıklığı
          </li>
          <li>
            <strong>Sefer Aralığı:</strong> Sefer sırasında konum gönderme sıklığı
          </li>
          <li className="hidden sm:list-item">
            <strong>Ev Yarıçapı:</strong> Şoförün evde sayılacağı mesafe
          </li>
          <li className="hidden sm:list-item">
            <strong>Başlama Hız Eşiği:</strong> Seferin başladığı kabul edilen minimum hız
          </li>
          <li className="hidden sm:list-item">
            <strong>Bitiş Bekleme Süresi:</strong> Bu süre hareketsiz kalınırsa sefer sonlandırılır
          </li>
        </ul>
      </div>
    </div>
  )
}
