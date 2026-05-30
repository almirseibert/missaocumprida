'use client'

import { useEffect, useRef } from 'react'

interface BlurredMapViewProps {
  lat: number
  lng: number
  radiusMeters?: number
  height?: number
}

export function BlurredMapView({ lat, lng, radiusMeters = 500, height = 220 }: BlurredMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const initializingRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current || initializingRef.current) return
    initializingRef.current = true

    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) { initializingRef.current = false; return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl

      const map = L.map(containerRef.current!, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        keyboard: false,
        attributionControl: false,
      }).setView([lat, lng], 14)

      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

      // Área sombreada com raio de ~500m
      L.circle([lat, lng], {
        radius: radiusMeters,
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '6 4',
      }).addTo(map)

      // Pin central com tooltip "Serviço nessa área"
      const areaIcon = L.divIcon({
        html: `<div style="background:#6366f1;color:white;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25)">📍 Serviço nessa área</div>`,
        iconAnchor: [70, 12],
        className: '',
      })
      L.marker([lat, lng], { icon: areaIcon, interactive: false }).addTo(map)
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      initializingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <div
        ref={containerRef}
        style={{ height, width: '100%', borderRadius: '0.75rem', overflow: 'hidden', zIndex: 0 }}
      />
    </>
  )
}
