import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { locationsApi, driversApi } from '../services/api'
import { Link } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface LiveLocation {
  driver_id: string
  driver_name: string
  driver_surname: string
  latitude: number
  longitude: number
  speed: number
  current_status: string
  updated_at: string
  province?: string
  district?: string
  is_moving?: boolean
  activity_type?: string
  phone_in_use?: boolean
}

interface Driver {
  id: string
  name: string
  surname: string
  phone: string
  current_status: string
  last_latitude?: number
  last_longitude?: number
  last_location_at?: string
  is_active: boolean
}

export default function LiveTrackingPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'speed' | 'updated'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Canlı konum verisi
  const { data: liveData, refetch: refetchLive } = useQuery({
    queryKey: ['live-locations'],
    queryFn: () => locationsApi.getLive(),
    refetchInterval: 10000, // Her 10 saniyede güncelle
  })

  // Şoför listesi (telefon numaraları için)
  const { data: driversData } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => driversApi.getAll({ limit: 500 }),
  })

  const liveLocations: LiveLocation[] = liveData?.data?.locations || []
  const drivers: Driver[] = driversData?.data?.drivers || []

  // Şoför bilgilerini birleştir
  const enrichedLocations = liveLocations.map(loc => {
    const driver = drivers.find(d => d.id === loc.driver_id)
    return {
      ...loc,
      phone: driver?.phone || '-',
      is_active: driver?.is_active ?? true,
    }
  })

  // Arama ve sıralama
  const filteredLocations = enrichedLocations
    .filter(loc => {
      const fullName = `${loc.driver_name} ${loc.driver_surname}`.toLowerCase()
      const phone = loc.phone?.toLowerCase() || ''
      return fullName.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm.toLowerCase())
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = `${a.driver_name} ${a.driver_surname}`.localeCompare(`${b.driver_name} ${b.driver_surname}`)
          break
        case 'speed':
          comparison = (a.speed || 0) - (b.speed || 0)
          break
        case 'updated':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  // Hız durumuna göre renk
  const getSpeedColor = (speed: number) => {
    if (speed >= 80) return 'text-red-600 bg-red-50'
    if (speed >= 50) return 'text-orange-600 bg-orange-50'
    if (speed >= 30) return 'text-green-600 bg-green-50'
    if (speed > 0) return 'text-blue-600 bg-blue-50'
    return 'text-gray-600 bg-gray-50'
  }

  // Durum badge
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      moving: { label: 'Hareket Halinde', color: 'bg-green-100 text-green-800' },
      stationary: { label: 'Duruyor', color: 'bg-gray-100 text-gray-800' },
      on_trip: { label: 'Seyahatte', color: 'bg-orange-100 text-orange-800' },
      at_home: { label: 'Evde', color: 'bg-blue-100 text-blue-800' },
      active: { label: 'Aktif', color: 'bg-green-100 text-green-800' },
      inactive: { label: 'Pasif', color: 'bg-gray-100 text-gray-800' },
    }
    const s = statusMap[status] || { label: status || 'Bilinmiyor', color: 'bg-gray-100 text-gray-800' }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
        {s.label}
      </span>
    )
  }

  // Konum güncellik durumu
  const getUpdateStatus = (updatedAt: string) => {
    if (!updatedAt) return { label: 'Bilinmiyor', color: 'text-gray-500' }
    const diff = Date.now() - new Date(updatedAt).getTime()
    const minutes = diff / 1000 / 60

    if (minutes < 2) return { label: 'Canlı', color: 'text-green-600' }
    if (minutes < 5) return { label: `${Math.floor(minutes)} dk önce`, color: 'text-green-500' }
    if (minutes < 15) return { label: `${Math.floor(minutes)} dk önce`, color: 'text-yellow-600' }
    if (minutes < 60) return { label: `${Math.floor(minutes)} dk önce`, color: 'text-orange-600' }
    return { label: formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: tr }), color: 'text-red-600' }
  }

  const handleSort = (field: 'name' | 'speed' | 'updated') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  // İstatistikler
  const stats = {
    total: filteredLocations.length,
    moving: filteredLocations.filter(l => (l.speed || 0) > 5).length,
    fast: filteredLocations.filter(l => (l.speed || 0) >= 30).length,
    stationary: filteredLocations.filter(l => (l.speed || 0) <= 5).length,
    phoneInUse: filteredLocations.filter(l => l.phone_in_use).length,
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Canlı Takip</h1>
        <p className="text-gray-500 mt-1">Tüm şoförlerin anlık konum ve hız bilgileri</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Toplam Şoför</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Hareket Halinde</div>
          <div className="text-2xl font-bold text-green-600">{stats.moving}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Hızlı (30+ km/s)</div>
          <div className="text-2xl font-bold text-orange-600">{stats.fast}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Duruyor</div>
          <div className="text-2xl font-bold text-gray-600">{stats.stationary}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Telefon Kullanan</div>
          <div className="text-2xl font-bold text-red-600">{stats.phoneInUse}</div>
        </div>
      </div>

      {/* Search and Refresh */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Şoför adı veya telefon ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => refetchLive()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Yenile
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Şoför
                    {sortBy === 'name' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Telefon
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('speed')}
                >
                  <div className="flex items-center gap-1">
                    Hız
                    {sortBy === 'speed' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Konum (GPS)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Telefon
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('updated')}
                >
                  <div className="flex items-center gap-1">
                    Son Güncelleme
                    {sortBy === 'updated' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLocations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? 'Arama sonucu bulunamadı' : 'Canlı konum verisi yok'}
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc) => {
                  const updateStatus = getUpdateStatus(loc.updated_at)
                  return (
                    <tr key={loc.driver_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/drivers/${loc.driver_id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {loc.driver_name} {loc.driver_surname}
                        </Link>
                        {(loc.province || loc.district) && (
                          <div className="text-xs text-gray-500">
                            {loc.province}{loc.district ? `, ${loc.district}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(loc as any).phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getSpeedColor(loc.speed || 0)}`}>
                          {(loc.speed || 0).toFixed(0)} km/s
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="text-gray-900 font-mono text-xs">
                          {loc.latitude?.toFixed(6)}, {loc.longitude?.toFixed(6)}
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 text-xs"
                        >
                          Haritada Gör
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(loc.current_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {loc.phone_in_use ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                            </svg>
                            Kullanımda
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className={`font-medium ${updateStatus.color}`}>
                          {updateStatus.label}
                        </div>
                        {loc.updated_at && (
                          <div className="text-xs text-gray-400">
                            {format(new Date(loc.updated_at), 'HH:mm:ss', { locale: tr })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/drivers/${loc.driver_id}`}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Detay
                        </Link>
                        <Link
                          to={`/drivers/${loc.driver_id}/route`}
                          className="text-green-600 hover:text-green-900"
                        >
                          Rota
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="mt-4 text-center text-sm text-gray-500">
        Veriler her 10 saniyede otomatik güncellenir
      </div>
    </div>
  )
}
