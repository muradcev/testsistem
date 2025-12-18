import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { routingApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  MapPinIcon,
  ArrowRightIcon,
  CalculatorIcon,
  TrashIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

// Türkiye illeri
const PROVINCES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
  'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik',
  'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum',
  'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
  'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
  'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale',
  'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa',
  'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye',
  'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak',
  'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
]

interface DistanceResult {
  origin: string
  destination: string
  distance_km: number
  duration_minutes?: number
  distance_type?: string
}

export default function DistanceCalculatorPage() {
  const [originProvince, setOriginProvince] = useState('')
  const [destProvince, setDestProvince] = useState('')
  const [results, setResults] = useState<DistanceResult[]>([])
  const [matrixProvinces, setMatrixProvinces] = useState<string[]>([])
  const [matrixResult, setMatrixResult] = useState<any>(null)

  // OSRM durumu
  const { data: statusData } = useQuery({
    queryKey: ['routing-status'],
    queryFn: () => routingApi.getStatus(),
    refetchInterval: 30000,
  })

  // Cache stats
  const { data: cacheData, refetch: refetchCache } = useQuery({
    queryKey: ['routing-cache'],
    queryFn: () => routingApi.getCacheStats(),
  })

  // Cache temizleme
  const clearCacheMutation = useMutation({
    mutationFn: () => routingApi.clearCache(),
    onSuccess: () => {
      toast.success('Cache temizlendi')
      refetchCache()
    },
    onError: () => toast.error('Cache temizlenemedi'),
  })

  // Province matrix mutation
  const matrixMutation = useMutation({
    mutationFn: (provinces: string[]) => routingApi.getProvinceMatrix(provinces),
    onSuccess: (response) => {
      setMatrixResult(response.data)
      toast.success('Mesafe matrisi hesaplandı')
    },
    onError: () => toast.error('Hesaplama başarısız'),
  })

  // Tek mesafe hesaplama
  const calculateDistance = async () => {
    if (!originProvince || !destProvince) {
      toast.error('Başlangıç ve varış ilini seçin')
      return
    }

    if (originProvince === destProvince) {
      toast.error('Başlangıç ve varış ili aynı olamaz')
      return
    }

    try {
      const response = await routingApi.getProvinceMatrix([originProvince, destProvince])
      const data = response.data as any

      if (data.distances && data.distances[0] && data.distances[0][1]) {
        const result: DistanceResult = {
          origin: originProvince,
          destination: destProvince,
          distance_km: Math.round(data.distances[0][1].distance_km),
          duration_minutes: data.distances[0][1].duration_minutes
            ? Math.round(data.distances[0][1].duration_minutes)
            : undefined,
          distance_type: data.distances[0][1].is_osrm ? 'Karayolu' : 'Kuş uçuşu',
        }
        setResults((prev) => [result, ...prev.slice(0, 9)])
        toast.success(`${originProvince} → ${destProvince}: ${result.distance_km} km`)
      }
    } catch {
      toast.error('Mesafe hesaplanamadı')
    }
  }

  // Matrix hesaplama
  const calculateMatrix = () => {
    if (matrixProvinces.length < 2) {
      toast.error('En az 2 il seçin')
      return
    }
    matrixMutation.mutate(matrixProvinces)
  }

  const status = statusData?.data
  const cache = cacheData?.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mesafe Hesaplama</h1>
          <p className="text-sm text-gray-500 mt-1">
            İller arası karayolu mesafesi hesaplama aracı
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              status?.available
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            OSRM: {status?.available ? 'Aktif' : 'Pasif'}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Cache: {cache?.cached_routes || 0} rota
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tek Mesafe Hesaplama */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CalculatorIcon className="h-5 w-5 text-primary-600" />
            İki İl Arası Mesafe
          </h2>

          <div className="space-y-4">
            {/* Başlangıç */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç İli
              </label>
              <select
                value={originProvince}
                onChange={(e) => setOriginProvince(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Seçin...</option>
                {PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            </div>

            {/* Varış */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Varış İli
              </label>
              <select
                value={destProvince}
                onChange={(e) => setDestProvince(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Seçin...</option>
                {PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={calculateDistance}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <MapPinIcon className="h-5 w-5" />
              Mesafe Hesapla
            </button>
          </div>

          {/* Sonuçlar */}
          {results.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Son Hesaplamalar</h3>
              <div className="space-y-2">
                {results.map((r, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{r.origin}</span>
                      <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{r.destination}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary-600">{r.distance_km} km</div>
                      {r.duration_minutes && (
                        <div className="text-xs text-gray-500">
                          ~{Math.floor(r.duration_minutes / 60)}s {r.duration_minutes % 60}dk
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mesafe Matrisi */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-primary-600" />
            Mesafe Matrisi
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                İller ({matrixProvinces.length}/10)
              </label>
              <select
                onChange={(e) => {
                  const val = e.target.value
                  if (val && !matrixProvinces.includes(val) && matrixProvinces.length < 10) {
                    setMatrixProvinces([...matrixProvinces, val])
                  }
                  e.target.value = ''
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">İl ekle...</option>
                {PROVINCES.filter((p) => !matrixProvinces.includes(p)).map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            </div>

            {/* Seçili İller */}
            <div className="flex flex-wrap gap-2">
              {matrixProvinces.map((prov) => (
                <span
                  key={prov}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                >
                  {prov}
                  <button
                    onClick={() =>
                      setMatrixProvinces(matrixProvinces.filter((p) => p !== prov))
                    }
                    className="hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={calculateMatrix}
                disabled={matrixProvinces.length < 2 || matrixMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {matrixMutation.isPending ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ChartBarIcon className="h-5 w-5" />
                )}
                Matrisi Hesapla
              </button>
              <button
                onClick={() => {
                  setMatrixProvinces([])
                  setMatrixResult(null)
                }}
                className="p-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Matrix Sonucu */}
          {matrixResult && (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-gray-500">km</th>
                    {matrixResult.origins?.map((o: any, i: number) => (
                      <th key={i} className="px-2 py-1 text-center font-medium text-gray-700">
                        {o.name?.slice(0, 3) || `${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixResult.distances?.map((row: any[], i: number) => (
                    <tr key={i}>
                      <td className="px-2 py-1 font-medium text-gray-700">
                        {matrixResult.origins?.[i]?.name?.slice(0, 3) || `${i + 1}`}
                      </td>
                      {row.map((cell: any, j: number) => (
                        <td
                          key={j}
                          className={`px-2 py-1 text-center ${
                            i === j
                              ? 'bg-gray-100 text-gray-400'
                              : 'bg-blue-50 text-blue-800 font-medium'
                          }`}
                        >
                          {i === j ? '-' : Math.round(cell.distance_km)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Cache Yönetimi */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Cache Yönetimi</h2>
            <p className="text-sm text-gray-500">
              Hesaplanan mesafeler 7 gün boyunca önbellekte tutulur
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {cache?.cached_routes || 0}
              </div>
              <div className="text-xs text-gray-500">Önbellekteki Rota</div>
            </div>
            <button
              onClick={() => clearCacheMutation.mutate()}
              disabled={clearCacheMutation.isPending}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {clearCacheMutation.isPending ? 'Temizleniyor...' : 'Cache Temizle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
