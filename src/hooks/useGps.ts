import { useEffect, useState, useRef } from 'react';
import { GeoLocationData } from '../types';
import { reverseGeocode } from '../services/gps';

export function useGps(enableHighAccuracy = true) {
  const [location, setLocation] = useState<GeoLocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(true);
  const [heading, setHeading] = useState<number | null>(null);
  const lastGeocodedKey = useRef<string>('');

  // 1. Geolocation Watcher
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy, altitude, heading: posHeading, speed } = pos.coords;

        setIsSearching(false);
        setError(null);

        const newLoc: GeoLocationData = {
          latitude,
          longitude,
          accuracy,
          altitude: altitude || null,
          heading: posHeading || heading || null,
          speed: speed || null,
          timestamp: pos.timestamp || Date.now(),
        };

        setLocation(prev => ({
          ...newLoc,
          address: prev?.address // preserve existing address while fetching
        }));

        // Debounced reverse geocode check (~100m grid)
        const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
        if (key !== lastGeocodedKey.current) {
          lastGeocodedKey.current = key;
          const address = await reverseGeocode(latitude, longitude);
          if (address) {
            setLocation(prev => prev ? { ...prev, address } : null);
          }
        }
      },
      (err) => {
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
      {
        enableHighAccuracy,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enableHighAccuracy]);

  // 2. Device Orientation Compass Listener
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // webkitCompassHeading for iOS, alpha for Android
      let compass: number | null = null;
      if ((event as any).webkitCompassHeading) {
        compass = (event as any).webkitCompassHeading;
      } else if (event.alpha !== null && event.alpha !== undefined) {
        compass = 360 - event.alpha;
      }

      if (compass !== null && !isNaN(compass)) {
        setHeading(Math.round(compass));
        setLocation(prev => prev ? { ...prev, heading: Math.round(compass) } : null);
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  return { location, error, isSearching, heading };
}
