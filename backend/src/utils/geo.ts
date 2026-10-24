// Faixas de distância exibidas a terceiros. Nunca devolvemos a distância exata
// entre dois pontos para quem pode escolher livremente a própria posição: com
// 3 consultas daria para triangular o endereço da outra pessoa.
const DISTANCE_BUCKETS_KM = [1, 3, 5, 10, 20, 50]

export function distanceBucket(km: number): { distance_km: number; distance_label: string } {
  let lower = 0
  for (const upper of DISTANCE_BUCKETS_KM) {
    if (km < upper) {
      return {
        distance_km: upper,
        distance_label: lower === 0 ? `menos de ${upper} km` : `${lower}–${upper} km`,
      }
    }
    lower = upper
  }
  return { distance_km: lower, distance_label: `mais de ${lower} km` }
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
