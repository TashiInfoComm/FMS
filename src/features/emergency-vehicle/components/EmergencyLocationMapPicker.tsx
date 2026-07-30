import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

import { getGoogleMapsApiKey } from '@/features/emergency-vehicle/lib/emergency-broadcast-ui'
import { cn } from '@/lib/utils'

/** Fallback map center (Thimphu) when geolocation is unavailable. */
const DEFAULT_CENTER = { lat: 27.4728, lng: 89.6393 }

const MAP_CONTAINER_STYLE: CSSProperties = {
  width: '100%',
  height: '300px',
}

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  clickableIcons: true,
}

type EmergencyLocationMapPickerProps = {
  address: string
  latitude: number | null
  longitude: number | null
  /** When false, pin drops only update coordinates (location text stays free). Default false. */
  syncAddress?: boolean
  onChange: (next: {
    address: string
    latitude: number | null
    longitude: number | null
  }) => void
  className?: string
}

function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function EmergencyLocationMapPicker({
  address,
  latitude,
  longitude,
  syncAddress = false,
  onChange,
  className,
}: EmergencyLocationMapPickerProps) {
  const apiKey = getGoogleMapsApiKey()
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'fms-emergency-google-maps',
    googleMapsApiKey: apiKey,
  })

  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const hasUserPinRef = useRef(latitude != null && longitude != null)
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const addressRef = useRef(address)
  addressRef.current = address

  useEffect(() => {
    if (latitude != null && longitude != null) {
      hasUserPinRef.current = true
      setMapCenter({ lat: latitude, lng: longitude })
    }
  }, [latitude, longitude])

  useEffect(() => {
    if (hasUserPinRef.current || !navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (hasUserPinRef.current) return
        setMapCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        // Keep DEFAULT_CENTER when permission is denied or location is unavailable.
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  useEffect(() => {
    if (isLoaded && !geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder()
    }
  }, [isLoaded])

  const applyPin = useCallback(
    (lat: number, lng: number) => {
      hasUserPinRef.current = true
      if (!syncAddress) {
        onChange({
          address: addressRef.current,
          latitude: lat,
          longitude: lng,
        })
        return
      }

      if (!geocoderRef.current) {
        onChange({
          address: addressRef.current.trim() || formatLatLng(lat, lng),
          latitude: lat,
          longitude: lng,
        })
        return
      }

      setIsGeocoding(true)
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        setIsGeocoding(false)
        if (status === 'OK' && results?.[0]?.formatted_address) {
          onChange({
            address: results[0].formatted_address,
            latitude: lat,
            longitude: lng,
          })
          return
        }
        onChange({
          address: addressRef.current.trim() || formatLatLng(lat, lng),
          latitude: lat,
          longitude: lng,
        })
      })
    },
    [onChange, syncAddress],
  )

  const handleMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      const latLng = event.latLng
      if (!latLng) return
      const lat = latLng.lat()
      const lng = latLng.lng()
      setMapCenter({ lat, lng })
      applyPin(lat, lng)
    },
    [applyPin],
  )

  if (!apiKey) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-[var(--fms-strokes)] bg-[#fafafa] p-4 text-sm text-[var(--fms-text-subheading)]',
          className,
        )}
      >
        Google Maps API key is missing. Set <code className="text-xs">VITE_MAP_API_KEY</code> in
        your <code className="text-xs">.env</code> file.
      </div>
    )
  }

  if (loadError) {
    return (
      <div
        className={cn(
          'rounded-lg border border-[var(--fms-error-border)] bg-[var(--fms-error-fill)] p-4 text-sm text-[var(--fms-error-text)]',
          className,
        )}
      >
        Failed to load Google Maps. Check the API key and Maps JavaScript API access.
      </div>
    )
  }

  const markerPosition =
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null

  return (
    <div className={cn('space-y-2', className)}>
      <div className="overflow-hidden rounded-lg border border-[var(--fms-strokes)]">
        {!isLoaded ? (
          <div
            className="flex items-center justify-center bg-[#f6f6f7] text-sm text-[var(--fms-text-subheading)]"
            style={MAP_CONTAINER_STYLE}
          >
            Loading map…
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={mapCenter}
            zoom={markerPosition ? 16 : 15}
            options={MAP_OPTIONS}
            onClick={handleMapClick}
          >
            {markerPosition ? <Marker position={markerPosition} /> : null}
          </GoogleMap>
        )}
      </div>

      <p className="text-xs text-[var(--fms-text-subheading)]">
        {isGeocoding
          ? 'Resolving location…'
          : markerPosition
            ? `Selected: ${formatLatLng(markerPosition.lat, markerPosition.lng)}. Click the map to move the pin.`
            : 'Click the map to set latitude and longitude.'}
      </p>
    </div>
  )
}
