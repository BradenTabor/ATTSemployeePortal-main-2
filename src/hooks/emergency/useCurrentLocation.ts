/**
 * useCurrentLocation — GPS + reverse geocoding for EAP "Tell 911 you are at".
 * Primary: device GPS. Fallback: config site (passed by caller).
 * Uses Google Geocoding API REST (no Maps SDK load).
 */

import { useState, useEffect, useCallback } from 'react';

export interface LiveLocation {
  address: string;
  coordinates: { lat: number; lng: number };
  crossStreets?: string;
}

export type CurrentLocationStatus = 'idle' | 'loading' | 'success' | 'error' | 'denied' | 'unsupported';

export interface UseCurrentLocationReturn {
  liveLocation: LiveLocation | null;
  status: CurrentLocationStatus;
  error: string | null;
  refetch: () => void;
}

const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey: string
): Promise<{ address: string; crossStreets?: string }> {
  const url = `${GEOCODE_BASE}?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(data.status === 'ZERO_RESULTS' ? 'No address found' : data.status || 'Geocoding failed');
  }

  const first = data.results[0];
  const formattedAddress = first.formatted_address || '';
  const components = first.address_components || [];
  const route = components.find((c: { types: string[] }) => c.types.includes('route'));
  const streetNum = components.find((c: { types: string[] }) => c.types.includes('street_number'));
  const crossStreets =
    route || streetNum
      ? [streetNum?.long_name, route?.long_name].filter(Boolean).join(' ')
      : undefined;

  return { address: formattedAddress, crossStreets };
}

export function useCurrentLocation(): UseCurrentLocationReturn {
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [status, setStatus] = useState<CurrentLocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const apiKey = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GOOGLE_MAPS_API_KEY : undefined;
  const hasApiKey = !!apiKey && apiKey !== 'your-api-key-here';

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      setError('Geolocation not supported');
      return;
    }
    if (!hasApiKey) {
      setStatus('error');
      setError('Google Maps API key not configured');
      return;
    }

    setStatus('loading');
    setError(null);
    setLiveLocation(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const { address, crossStreets } = await reverseGeocode(lat, lng, apiKey!);
          setLiveLocation({ address, coordinates: { lat, lng }, crossStreets });
          setStatus('success');
        } catch (e) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Could not get address');
        }
      },
      (err: GeolocationPositionError) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('denied');
          setError('Location permission denied');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setStatus('error');
          setError('Location unavailable');
        } else if (err.code === err.TIMEOUT) {
          setStatus('error');
          setError('Location request timed out');
        } else {
          setStatus('error');
          setError('Could not get location');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [apiKey, hasApiKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate fetch-on-mount; async callbacks handle setState
    fetchLocation();
  }, [fetchLocation]);

  return { liveLocation, status, error, refetch: fetchLocation };
}
