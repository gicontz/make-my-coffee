'use client'

// Lets the customer confirm the exact delivery point by pin, instead of us
// trusting free-text geocoding of PH subdivision-style addresses ("Blk 17
// Lt 7 Zone 1 Bulihan"), which routinely fails to resolve to the right spot.
// Loaded via next/dynamic({ ssr: false }) from app/order/page.tsx — Leaflet
// needs the browser `window`.

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface LatLng {
  lat: number
  lng: number
}

export type SuggestionPrecision = 'address' | 'barangay' | 'city'

interface Props {
  value: LatLng | null
  onChange: (coords: LatLng) => void
  suggestedCenter?: LatLng | null
  // How specific the auto-suggestion is — see lib/geocoding.ts's fallback
  // chain (full address → barangay → city). Drives both the starting zoom
  // and whether we tell the customer to double-check the pin.
  suggestedPrecision?: SuggestionPrecision | null
}

const DEFAULT_CENTER: LatLng = { lat: 14.6, lng: 121.0 } // Metro Manila
const DEFAULT_ZOOM = 11
const CITY_ZOOM = 13
const BARANGAY_ZOOM = 15
const PIN_ZOOM = 16

// Custom pin (brand espresso-900 / espresso-400) — sidesteps Leaflet's
// well-known default-marker-icon-path breakage under webpack bundlers.
const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.716 23.284 0 15 0z" fill="#1C0A00"/>
    <circle cx="15" cy="15" r="5.5" fill="#C8860A"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
})

function ClickHandler({ onPick }: { onPick: (c: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function Recenter({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng])
  return null
}

export default function DeliveryMapPicker({ value, onChange, suggestedCenter, suggestedPrecision }: Props) {
  // Once the customer touches the map themselves, stop overriding their pin
  // with new address-typed suggestions.
  const manuallySet = useRef(false)
  const [locating, setLocating] = useState(false)
  // Precision behind the currently-applied pin — 'manual' once the customer
  // has placed it themselves (map tap, drag, or "Use My Location"), otherwise
  // whatever lib/geocoding.ts's fallback chain resolved to.
  const [appliedPrecision, setAppliedPrecision] = useState<SuggestionPrecision | 'manual' | null>(null)

  useEffect(() => {
    if (suggestedCenter && !manuallySet.current) {
      onChange(suggestedCenter)
      setAppliedPrecision(suggestedPrecision ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedCenter?.lat, suggestedCenter?.lng, suggestedPrecision])

  function handlePick(coords: LatLng) {
    manuallySet.current = true
    setAppliedPrecision('manual')
    onChange(coords)
  }

  function useMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        manuallySet.current = true
        setAppliedPrecision('manual')
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const isConfirmed = appliedPrecision === 'manual' || appliedPrecision === 'address'
  const center = value ?? suggestedCenter ?? DEFAULT_CENTER
  const zoom = !value
    ? DEFAULT_ZOOM
    : appliedPrecision === 'city'
      ? CITY_ZOOM
      : appliedPrecision === 'barangay'
        ? BARANGAY_ZOOM
        : PIN_ZOOM

  return (
    <div>
      <div className="rounded-xl overflow-hidden border border-espresso-200 h-64 relative">
        <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={handlePick} />
          <Recenter center={center} zoom={zoom} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: e => {
                  const pos = (e.target as L.Marker).getLatLng()
                  handlePick({ lat: pos.lat, lng: pos.lng })
                },
              }}
            />
          )}
        </MapContainer>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="absolute bottom-2 right-2 z-[1000] bg-white hover:bg-espresso-50 border border-espresso-200 rounded-full px-3 py-1.5 text-xs font-semibold text-espresso-700 shadow-sm disabled:opacity-60 flex items-center gap-1.5 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          {locating ? 'Locating…' : 'Use My Location'}
        </button>
      </div>
      <p className={`text-xs mt-2 flex items-center gap-1.5 ${isConfirmed ? 'text-espresso-500' : 'text-espresso-600'}`}>
        {!value ? (
          'Tap the map to drop a pin at your exact delivery spot — this keeps the delivery fee accurate.'
        ) : isConfirmed ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Pin set — drag it to fine-tune your exact delivery spot.
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C8860A" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            {appliedPrecision === 'barangay'
              ? "We centered this on your barangay — drag the pin to your exact spot."
              : "We couldn't find that exact address — centered on your city instead. Drag the pin to your exact spot."}
          </>
        )}
      </p>
    </div>
  )
}
