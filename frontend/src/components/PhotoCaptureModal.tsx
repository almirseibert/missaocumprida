'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, X, RotateCcw, Check, MapPin } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import toast from 'react-hot-toast'

interface CaptureResult {
  file: File
  lat: number | null
  lng: number | null
  address: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onCapture: (result: CaptureResult) => void
  title: string
}

// OSM tile helpers
function lngToTileX(lng: number, zoom: number) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
}
function latToTileY(lat: number, zoom: number) {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, zoom))
}

async function fetchMapTile(lat: number, lng: number): Promise<HTMLImageElement | null> {
  const zoom = 15
  const x = lngToTileX(lng, zoom)
  const y = latToTileY(lat, zoom)
  const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MissaoCumprida/1.0' } })
    if (!res.ok) return null
    const blob = await res.blob()
    const src = URL.createObjectURL(blob)
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { URL.revokeObjectURL(src); resolve(img) }
      img.onerror = () => resolve(null)
      img.src = src
    })
  } catch {
    return null
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'pt-BR' } },
    )
    const data = await res.json()
    const a = data.address
    const parts = [a.road, a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean)
    return parts.join(', ') || data.display_name?.split(',').slice(0, 3).join(',') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

function formatDateTimeFull(d: Date) {
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function PhotoCaptureModal({ isOpen, onClose, onCapture, title }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [address, setAddress] = useState<string>('Obtendo localização...')
  const [locating, setLocating] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setPreview(null)
    setCapturedBlob(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch {
      toast.error('Não foi possível acessar a câmera. Verifique as permissões.')
    }
  }, [])

  // Get location on open
  useEffect(() => {
    if (!isOpen) return
    startCamera()
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setLocation({ lat, lng })
        const addr = await reverseGeocode(lat, lng)
        setAddress(addr)
        setLocating(false)
      },
      () => {
        setAddress('Localização não disponível')
        setLocating(false)
      },
      { timeout: 10000, enableHighAccuracy: true },
    )
    return () => stopStream()
  }, [isOpen, startCamera, stopStream])

  async function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const W = video.videoWidth || 1280
    const H = video.videoHeight || 960
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    // Draw video frame
    ctx.drawImage(video, 0, 0, W, H)

    // ----- Overlay -----
    const barH = Math.round(H * 0.18)
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(0, H - barH, W, barH)

    const fontSize = Math.max(14, Math.round(W * 0.022))
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = '#FFFFFF'

    const now = new Date()
    ctx.fillText(formatDateTimeFull(now), 14, H - barH + fontSize + 8)

    ctx.font = `${Math.round(fontSize * 0.85)}px sans-serif`
    ctx.fillStyle = '#FFD700'
    const addrLine = address.length > 55 ? address.slice(0, 55) + '…' : address
    ctx.fillText(`📍 ${addrLine}`, 14, H - barH + fontSize * 2 + 18)

    if (location) {
      ctx.fillStyle = '#AAFFAA'
      ctx.font = `${Math.round(fontSize * 0.75)}px monospace`
      ctx.fillText(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`, 14, H - barH + fontSize * 3 + 24)
    }

    // Mini-map in bottom-right corner
    if (location) {
      const mapSize = Math.round(Math.min(W, H) * 0.22)
      const mapX = W - mapSize - 10
      const mapY = H - mapSize - 10
      const tile = await fetchMapTile(location.lat, location.lng)
      if (tile) {
        ctx.save()
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(mapX, mapY, mapSize, mapSize, 6)
        else ctx.rect(mapX, mapY, mapSize, mapSize)
        ctx.clip()
        ctx.drawImage(tile, mapX, mapY, mapSize, mapSize)
        ctx.restore()
        // Border
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(mapX, mapY, mapSize, mapSize, 6)
        else ctx.rect(mapX, mapY, mapSize, mapSize)
        ctx.stroke()
        // Center pin
        ctx.fillStyle = '#E53E3E'
        ctx.beginPath()
        ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setCapturedBlob(blob)
        setPreview(canvas.toDataURL('image/jpeg', 0.92))
        stopStream()
      },
      'image/jpeg',
      0.92,
    )
  }

  async function confirm() {
    if (!capturedBlob) return
    setConfirming(true)
    const file = new File([capturedBlob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
    onCapture({
      file,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      address,
    })
    setConfirming(false)
    handleClose()
  }

  function handleClose() {
    stopStream()
    setPreview(null)
    setCapturedBlob(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="space-y-4">
        {/* Location status */}
        <div className={`flex items-center gap-2 text-sm ${locating ? 'text-yellow-600' : location ? 'text-green-600' : 'text-red-500'}`}>
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{locating ? 'Obtendo localização GPS…' : address}</span>
        </div>

        {/* Camera / preview area */}
        <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
          {preview ? (
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          )}
        </div>

        {/* Hidden canvas for composition */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Action buttons */}
        {!preview ? (
          <Button onClick={capture} fullWidth size="lg" disabled={locating}>
            <Camera className="w-5 h-5" /> Capturar Foto
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => { setPreview(null); setCapturedBlob(null); startCamera() }}>
              <RotateCcw className="w-4 h-4" /> Tirar novamente
            </Button>
            <Button fullWidth onClick={confirm} isLoading={confirming}>
              <Check className="w-4 h-4" /> Usar esta foto
            </Button>
          </div>
        )}

        <button onClick={handleClose} className="w-full text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
          <X className="w-3 h-3" /> Cancelar
        </button>
      </div>
    </Modal>
  )
}
