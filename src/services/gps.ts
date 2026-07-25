import { AddressInfo, GeoLocationData } from '../types';

// In-memory cache for reverse geocoding to prevent excessive API calls
const geocodeCache = new Map<string, AddressInfo>();

/**
 * Converts degrees to cardinal direction (N, NE, E, SE, S, SW, W, NW)
 */
export function headingToCardinal(heading: number | null | undefined): string {
  if (heading === null || heading === undefined || isNaN(heading)) return 'N/A';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((heading % 360) / 22.5);
  return directions[index % 16];
}

/**
 * Reverse Geocodes lat/lng into AddressInfo using Nominatim OpenStreetMap
 * Gracefully handles offline mode and never throws a blocking exception.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<AddressInfo | undefined> {
  // Round coordinates to ~100m for cache key
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  if (!navigator.onLine) {
    return undefined;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second aggressive timeout

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'SchoolEventGeoCameraApp/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return undefined;

    const data = await response.json();
    if (!data || !data.address) return undefined;

    const addr = data.address;
    const village = addr.village || addr.suburb || addr.neighbourhood || addr.hamlet || '';
    const city = addr.city || addr.town || addr.municipality || addr.county || '';
    const district = addr.state_district || addr.district || addr.subdistrict || '';
    const state = addr.state || '';
    const country = addr.country || '';
    const postcode = addr.postcode || '';

    const parts = [village, city, district, state, country].filter(Boolean);
    const formattedAddress = data.display_name || parts.join(', ');

    const addressInfo: AddressInfo = {
      village,
      city,
      district,
      state,
      country,
      postcode,
      formattedAddress,
    };

    geocodeCache.set(cacheKey, addressInfo);
    return addressInfo;
  } catch (error) {
    // Quiet failure for offline or slow network
    return undefined;
  }
}

/**
 * Formats coordinates nicely (e.g. 28.6139° N, 77.2090° E)
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
}

/**
 * Formats accuracy indicator
 */
export function getAccuracyLevel(accuracy: number): { level: 'high' | 'medium' | 'low'; label: string; color: string } {
  if (accuracy <= 10) {
    return { level: 'high', label: `±${Math.round(accuracy)}m (High)`, color: '#10b981' }; // Emerald
  } else if (accuracy <= 30) {
    return { level: 'medium', label: `±${Math.round(accuracy)}m (Medium)`, color: '#f59e0b' }; // Amber
  } else {
    return { level: 'low', label: `±${Math.round(accuracy)}m (Low)`, color: '#ef4444' }; // Red
  }
}
