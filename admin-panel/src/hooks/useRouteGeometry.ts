import { useQuery } from '@tanstack/react-query'
import { routingApi } from '../services/api'
import { useMemo } from 'react'

interface Location {
  latitude: number
  longitude: number
}

interface RouteGeometryResult {
  geometry: [number, number][]
  isLoading: boolean
  isError: boolean
  error: Error | null
}

// Noktaları belirli aralıklarla örnekle (OSRM max 100 waypoint destekler)
function samplePoints(locations: Location[], maxPoints: number = 50): [number, number][] {
  if (locations.length <= maxPoints) {
    return locations.map(l => [l.latitude, l.longitude])
  }

  const step = Math.ceil(locations.length / maxPoints)
  const sampled: [number, number][] = []

  // İlk noktayı ekle
  sampled.push([locations[0].latitude, locations[0].longitude])

  // Ara noktaları örnekle
  for (let i = step; i < locations.length - 1; i += step) {
    sampled.push([locations[i].latitude, locations[i].longitude])
  }

  // Son noktayı ekle
  const last = locations[locations.length - 1]
  sampled.push([last.latitude, last.longitude])

  return sampled
}

// Geçersiz koordinatları filtrele
function filterValidLocations(locations: Location[]): Location[] {
  return locations.filter(
    l => l.latitude && l.longitude &&
         !isNaN(l.latitude) && !isNaN(l.longitude) &&
         l.latitude >= -90 && l.latitude <= 90 &&
         l.longitude >= -180 && l.longitude <= 180
  )
}

export function useRouteGeometry(
  locations: Location[],
  options?: {
    enabled?: boolean
    maxPoints?: number
    staleTime?: number
  }
): RouteGeometryResult {
  const { enabled = true, maxPoints = 50, staleTime = 5 * 60 * 1000 } = options || {}

  // Geçerli lokasyonları filtrele
  const validLocations = useMemo(() => filterValidLocations(locations), [locations])

  // Noktaları örnekle
  const sampledPoints = useMemo(
    () => samplePoints(validLocations, maxPoints),
    [validLocations, maxPoints]
  )

  // Cache key için noktaların hash'i
  const pointsKey = useMemo(() => {
    if (sampledPoints.length < 2) return 'empty'
    // İlk ve son nokta + nokta sayısı ile basit bir key
    const first = sampledPoints[0]
    const last = sampledPoints[sampledPoints.length - 1]
    return `${first[0].toFixed(4)},${first[1].toFixed(4)}-${last[0].toFixed(4)},${last[1].toFixed(4)}-${sampledPoints.length}`
  }, [sampledPoints])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['route-geometry', pointsKey],
    queryFn: async () => {
      const response = await routingApi.getRouteGeometry(sampledPoints)
      return response.data
    },
    enabled: enabled && sampledPoints.length >= 2,
    staleTime,
    gcTime: 10 * 60 * 1000, // 10 dakika cache
    retry: 1,
  })

  // OSRM'den gelen geometry veya fallback olarak düz çizgi
  const geometry = useMemo<[number, number][]>(() => {
    if (data?.geometry && data.geometry.length > 0) {
      return data.geometry as [number, number][]
    }
    // Fallback: düz çizgi (orijinal noktalar)
    return validLocations.map(l => [l.latitude, l.longitude])
  }, [data, validLocations])

  return {
    geometry,
    isLoading,
    isError,
    error: error as Error | null,
  }
}

export default useRouteGeometry
