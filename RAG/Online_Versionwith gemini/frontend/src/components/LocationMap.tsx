import { getStateCoordinates, type StateCoordinates } from '@/lib/indianStatesCoordinates'

interface LocationMapProps {
    state?: string
    districts?: string[]
    height?: string
    className?: string
}

export function LocationMap({ state, districts, height = '300px', className = '' }: LocationMapProps) {
    // Get coordinates for the state
    const stateCoords: StateCoordinates | null = state ? getStateCoordinates(state) : null

    // If no valid location, show a message
    if (!stateCoords) {
        return (
            <div
                className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
                style={{ height }}
            >
                <p className="text-muted-foreground text-sm">
                    {state ? `Location "${state}" not found on map` : 'No location data available'}
                </p>
            </div>
        )
    }

    const locationLabel = districts && districts.length > 0
        ? `${districts.join(', ')}, ${stateCoords.name}`
        : stateCoords.name

    // Use OpenStreetMap embed URL
    const zoom = 7
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${stateCoords.lng - 3}%2C${stateCoords.lat - 2}%2C${stateCoords.lng + 3}%2C${stateCoords.lat + 2}&layer=mapnik&marker=${stateCoords.lat}%2C${stateCoords.lng}`

    return (
        <div className={`space-y-2 ${className}`}>
            <div
                className="rounded-lg overflow-hidden border relative"
                style={{ height }}
            >
                <iframe
                    src={mapUrl}
                    style={{ width: '100%', height: '100%', border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`Map showing ${locationLabel}`}
                />
                {/* Location label overlay */}
                <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-md shadow-sm border">
                    <span className="text-sm font-medium">{locationLabel}</span>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                <a
                    href={`https://www.openstreetmap.org/?mlat=${stateCoords.lat}&mlon=${stateCoords.lng}#map=${zoom}/${stateCoords.lat}/${stateCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-primary"
                >
                    View larger map →
                </a>
            </p>
        </div>
    )
}
