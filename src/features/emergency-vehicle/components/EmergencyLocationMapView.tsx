import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import type { CSSProperties } from 'react'

import { getGoogleMapsApiKey } from '@/features/emergency-vehicle/lib/emergency-broadcast-ui'
import { cn } from '@/lib/utils'

const MAP_CONTAINER_STYLE: CSSProperties = {
  width: '100%',
  height: '360px',
}

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  clickableIcons: false,
  draggableCursor: 'default',
}

type EmergencyLocationMapViewProps = {
  latitude: number
  longitude: number
  label?: string
  className?: string
}

/** Read-only Google Map with a marker at the given coordinates. */
export function EmergencyLocationMapView({
  latitude,
  longitude,
  label,
  className,
}: EmergencyLocationMapViewProps) {
  const apiKey = getGoogleMapsApiKey()
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'fms-emergency-google-maps',
    googleMapsApiKey: apiKey,
  })

  const position = { lat: latitude, lng: longitude }

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
            center={position}
            zoom={16}
            options={MAP_OPTIONS}
          >
            <Marker position={position} title={label} />
          </GoogleMap>
        )}
      </div>
      <p className="text-xs text-[var(--fms-text-subheading)]">
        {latitude.toFixed(5)}, {longitude.toFixed(5)}
        {label ? ` · ${label}` : ''}
      </p>
    </div>
  )
}
