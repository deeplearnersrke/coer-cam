import { useEffect, useState, useRef } from 'react';
import { GeoLocationData } from '../types';
import { reverseGeocode } from '../services/gps';

/**
 * GPS hook. When mounted at the app-shell level it keeps a single watch active
 * while the app is open, so page changes do not restart the GPS search.
 */
export function useGps(enableHighAccuracy = true) {
  const [location, setLocation] = useState<GeoLocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [heading, setHeading] = useState<number | null>(null);
  const lastGeocodedKey = useRef('');
  const requestId = useRef(0);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser');
      setIsSearching(false);
      return;
    }

    let disposed = false;
    setIsSearching(true);
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        if (disposed) return;
        const { latitude, longitude, accuracy, altitude, heading: posHeading, speed } = pos.coords;
        setIsSearching(false);
        setError(null);
        const next: GeoLocationData = {
          latitude,
          longitude,
          accuracy,
          altitude: altitude ?? null,
          heading: posHeading ?? heading ?? null,
          speed: speed ?? null,
          timestamp: pos.timestamp || Date.now(),
        };
        setLocation((prev) => ({ ...next, address: prev?.address }));

        // Reverse-geocode only after a meaningful movement; stale responses
        // are ignored so an older request cannot overwrite a newer address.
        const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
        if (key !== lastGeocodedKey.current) {
          lastGeocodedKey.current = key;
          const thisRequest = ++requestId.current;
          try {
            const address = await reverseGeocode(latitude, longitude);
            if (!disposed && thisRequest === requestId.current && address) {
              setLocation((prev) => prev ? { ...prev, address } : prev);
            }
          } catch {
            // GPS coordinates remain usable even if reverse geocoding fails.
          }
        }
      },
      (err) => {
        if (disposed) return;
        setIsSearching(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Photos can still be taken.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location information unavailable.');
            break;
          case err.TIMEOUT:
            setError('GPS request timed out.');
            break;
          default:
            setError('GPS Error: ' + err.message);
        }
      },
      { enableHighAccuracy, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      disposed = true;
      requestId.current++;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enableHighAccuracy]);

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      let compass: number | null = null;
      const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof webkitHeading === 'number') compass = webkitHeading;
      else if (typeof event.alpha === 'number') compass = 360 - event.alpha;
      if (compass !== null && Number.isFinite(compass)) {
        const value = Math.round((compass + 360) % 360);
        setHeading(value);
        setLocation((prev) => prev ? { ...prev, heading: value } : prev);
      }
    };
    if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, []);

  return { location, error, isSearching, heading };
}
