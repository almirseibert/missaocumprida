'use client'

import { useEffect, useRef } from 'react'
import { Order } from '@/types'

interface MapViewProps {
  orders: Order[]
  providerLat?: number | null
  providerLng?: number | null
  onOrderClick?: (order: Order) => void
}

export function MapView({ orders, providerLat, providerLng, onOrderClick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const initializingRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current || initializingRef.current) return
    initializingRef.current = true

    // Leaflet precisa do DOM — importação dinâmica para evitar SSR
    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) { initializingRef.current = false; return }

      // Fix ícones padrão do Leaflet com Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Centro inicial: provider ou primeiro pedido com coords ou São Paulo
      const ordersWithCoords = orders.filter(o => o.latitude != null && o.longitude != null)
      const centerLat = providerLat ?? ordersWithCoords[0]?.latitude ?? -23.5505
      const centerLng = providerLng ?? ordersWithCoords[0]?.longitude ?? -46.6333

      const map = L.map(containerRef.current!).setView([centerLat, centerLng], 12)
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)

      // Marcador do prestador
      if (providerLat != null && providerLng != null) {
        const providerIcon = L.divIcon({
          html: '<div style="background:#6366f1;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          className: '',
        })
        L.marker([providerLat, providerLng], { icon: providerIcon })
          .addTo(map)
          .bindPopup('<strong>Sua localização</strong>')
      }

      // Marcadores dos pedidos
      ordersWithCoords.forEach(order => {
        const marker = L.marker([order.latitude!, order.longitude!]).addTo(map)
        const distText = order.distance_km != null ? `<br><span style="color:#6366f1">${order.distance_km} km de você</span>` : ''
        const priceText = order.estimated_price_min
          ? `<br>R$ ${order.estimated_price_min.toFixed(0)}–${(order.estimated_price_max ?? order.estimated_price_min).toFixed(0)}`
          : ''
        marker.bindPopup(
          `<strong>${order.title}</strong>${priceText}${distText}<br><small>${order.city ?? ''}</small>`
        )
        if (onOrderClick) {
          marker.on('click', () => onOrderClick(order))
        }
      })

      // Ajustar bounds se tiver marcadores
      if (ordersWithCoords.length > 0 || (providerLat != null && providerLng != null)) {
        const points: [number, number][] = ordersWithCoords.map(o => [o.latitude!, o.longitude!])
        if (providerLat != null && providerLng != null) points.push([providerLat, providerLng])
        if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
      }
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      initializingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Atualiza marcadores quando orders mudam (sem recriar o mapa)
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then((L) => {
      if (!mapRef.current) return
      mapRef.current.eachLayer(layer => {
        if (layer instanceof L.Marker) {
          // Mantém marcador do provider, remove os de pedidos
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const popup = (layer as any).getPopup()?.getContent?.() as string | undefined
          if (popup && !popup.includes('Sua localização')) {
            mapRef.current!.removeLayer(layer)
          }
        }
      })
      orders
        .filter(o => o.latitude != null && o.longitude != null)
        .forEach(order => {
          const marker = L.marker([order.latitude!, order.longitude!]).addTo(mapRef.current!)
          const distText = order.distance_km != null ? `<br><span style="color:#6366f1">${order.distance_km} km de você</span>` : ''
          const priceText = order.estimated_price_min
            ? `<br>R$ ${order.estimated_price_min.toFixed(0)}–${(order.estimated_price_max ?? order.estimated_price_min).toFixed(0)}`
            : ''
          marker.bindPopup(
            `<strong>${order.title}</strong>${priceText}${distText}<br><small>${order.city ?? ''}</small>`
          )
          if (onOrderClick) marker.on('click', () => onOrderClick(order))
        })
    })
  }, [orders, onOrderClick])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <div ref={containerRef} style={{ height: '420px', width: '100%', borderRadius: '1rem', zIndex: 0 }} />
    </>
  )
}
