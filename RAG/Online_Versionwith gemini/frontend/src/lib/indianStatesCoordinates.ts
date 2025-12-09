// Indian states and Union Territories coordinates (approximate centers)
// Used for displaying project locations on the map

export interface StateCoordinates {
    name: string
    lat: number
    lng: number
}

export const indianStatesCoordinates: Record<string, StateCoordinates> = {
    // States
    'andhra pradesh': { name: 'Andhra Pradesh', lat: 15.9129, lng: 79.7400 },
    'arunachal pradesh': { name: 'Arunachal Pradesh', lat: 28.2180, lng: 94.7278 },
    'assam': { name: 'Assam', lat: 26.2006, lng: 92.9376 },
    'bihar': { name: 'Bihar', lat: 25.0961, lng: 85.3131 },
    'chhattisgarh': { name: 'Chhattisgarh', lat: 21.2787, lng: 81.8661 },
    'goa': { name: 'Goa', lat: 15.2993, lng: 74.1240 },
    'gujarat': { name: 'Gujarat', lat: 22.2587, lng: 71.1924 },
    'haryana': { name: 'Haryana', lat: 29.0588, lng: 76.0856 },
    'himachal pradesh': { name: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734 },
    'jharkhand': { name: 'Jharkhand', lat: 23.6102, lng: 85.2799 },
    'karnataka': { name: 'Karnataka', lat: 15.3173, lng: 75.7139 },
    'kerala': { name: 'Kerala', lat: 10.8505, lng: 76.2711 },
    'madhya pradesh': { name: 'Madhya Pradesh', lat: 22.9734, lng: 78.6569 },
    'maharashtra': { name: 'Maharashtra', lat: 19.7515, lng: 75.7139 },
    'manipur': { name: 'Manipur', lat: 24.6637, lng: 93.9063 },
    'meghalaya': { name: 'Meghalaya', lat: 25.4670, lng: 91.3662 },
    'mizoram': { name: 'Mizoram', lat: 23.1645, lng: 92.9376 },
    'nagaland': { name: 'Nagaland', lat: 26.1584, lng: 94.5624 },
    'odisha': { name: 'Odisha', lat: 20.9517, lng: 85.0985 },
    'punjab': { name: 'Punjab', lat: 31.1471, lng: 75.3412 },
    'rajasthan': { name: 'Rajasthan', lat: 27.0238, lng: 74.2179 },
    'sikkim': { name: 'Sikkim', lat: 27.5330, lng: 88.5122 },
    'tamil nadu': { name: 'Tamil Nadu', lat: 11.1271, lng: 78.6569 },
    'telangana': { name: 'Telangana', lat: 18.1124, lng: 79.0193 },
    'tripura': { name: 'Tripura', lat: 23.9408, lng: 91.9882 },
    'uttar pradesh': { name: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
    'uttarakhand': { name: 'Uttarakhand', lat: 30.0668, lng: 79.0193 },
    'west bengal': { name: 'West Bengal', lat: 22.9868, lng: 87.8550 },

    // Union Territories
    'andaman and nicobar islands': { name: 'Andaman and Nicobar Islands', lat: 11.7401, lng: 92.6586 },
    'chandigarh': { name: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
    'dadra and nagar haveli and daman and diu': { name: 'Dadra and Nagar Haveli and Daman and Diu', lat: 20.1809, lng: 73.0169 },
    'delhi': { name: 'Delhi', lat: 28.7041, lng: 77.1025 },
    'jammu and kashmir': { name: 'Jammu and Kashmir', lat: 33.7782, lng: 76.5762 },
    'ladakh': { name: 'Ladakh', lat: 34.1526, lng: 77.5771 },
    'lakshadweep': { name: 'Lakshadweep', lat: 10.5667, lng: 72.6417 },
    'puducherry': { name: 'Puducherry', lat: 11.9416, lng: 79.8083 },

    // Common alternate names
    'orissa': { name: 'Odisha', lat: 20.9517, lng: 85.0985 },
    'pondicherry': { name: 'Puducherry', lat: 11.9416, lng: 79.8083 },
    'uttaranchal': { name: 'Uttarakhand', lat: 30.0668, lng: 79.0193 },
}

// India center coordinates for default map view
export const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 }
export const INDIA_ZOOM = 5

/**
 * Get coordinates for a state name (case-insensitive)
 */
export function getStateCoordinates(stateName: string): StateCoordinates | null {
    if (!stateName) return null
    const normalized = stateName.toLowerCase().trim()
    return indianStatesCoordinates[normalized] || null
}

/**
 * Try to extract state from a location string that might include district info
 * E.g., "Guwahati, Assam" -> "Assam"
 */
export function extractStateFromLocation(location: string): StateCoordinates | null {
    if (!location) return null

    // Try direct lookup first
    const direct = getStateCoordinates(location)
    if (direct) return direct

    // Try splitting by comma and checking each part
    const parts = location.split(',').map(p => p.trim())
    for (const part of parts) {
        const coords = getStateCoordinates(part)
        if (coords) return coords
    }

    // Try finding any state name within the location string
    const normalized = location.toLowerCase()
    for (const [key, value] of Object.entries(indianStatesCoordinates)) {
        if (normalized.includes(key)) {
            return value
        }
    }

    return null
}
