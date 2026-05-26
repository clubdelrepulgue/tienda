import type { DeliveryZone } from "@/lib/types"

export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: { lat: number; lng: number }[]
): boolean {
  if (!polygon || polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi

    if (intersects) inside = !inside
  }

  return inside
}

export function findDeliveryZoneForPoint(
  zones: DeliveryZone[],
  point: { lat: number; lng: number }
) {
  return zones
    .filter((zone) => zone.isActive && isPointInPolygon(point, zone.coordinates))
    .sort((a, b) => getPolygonArea(a.coordinates) - getPolygonArea(b.coordinates))[0]
}

function getPolygonArea(polygon: { lat: number; lng: number }[]) {
  if (!polygon || polygon.length < 3) return Number.POSITIVE_INFINITY

  return Math.abs(
    polygon.reduce((area, point, index) => {
      const next = polygon[(index + 1) % polygon.length]
      return area + point.lng * next.lat - next.lng * point.lat
    }, 0) / 2
  )
}

export function getZoneDeliveryFee(zone: DeliveryZone | undefined, subtotal: number) {
  if (!zone) return 0
  if (zone.minOrderAmount > 0 && subtotal >= zone.minOrderAmount) return 0
  return zone.deliveryFee
}

export function formatZoneMeta(zone: DeliveryZone) {
  const parts = [`Envio $${zone.deliveryFee.toFixed(2)}`]

  if (zone.minOrderAmount > 0) {
    parts.push(`gratis desde $${zone.minOrderAmount.toFixed(2)}`)
  }

  if (zone.estimatedTimeMin) {
    parts.push(`${zone.estimatedTimeMin} min`)
  }

  return parts.join(" · ")
}

export function generateCirclePolygon(
  center: { lat: number; lng: number },
  radiusKm: number,
  points = 72
) {
  const earthRadiusKm = 6371
  const latRadians = (center.lat * Math.PI) / 180
  const lngRadians = (center.lng * Math.PI) / 180
  const angularDistance = radiusKm / earthRadiusKm

  return Array.from({ length: points }, (_, index) => {
    const bearing = (2 * Math.PI * index) / points
    const pointLat = Math.asin(
      Math.sin(latRadians) * Math.cos(angularDistance) +
        Math.cos(latRadians) * Math.sin(angularDistance) * Math.cos(bearing)
    )
    const pointLng =
      lngRadians +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRadians),
        Math.cos(angularDistance) - Math.sin(latRadians) * Math.sin(pointLat)
      )

    return {
      lat: (pointLat * 180) / Math.PI,
      lng: (pointLng * 180) / Math.PI,
    }
  })
}
