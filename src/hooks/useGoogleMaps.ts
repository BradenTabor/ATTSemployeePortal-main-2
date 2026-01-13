/**
 * useGoogleMaps Hook
 * 
 * Handles Google Maps API loading with error handling and state management.
 * Provides graceful fallback if API key is missing or load fails.
 */

import { useLoadScript } from '@react-google-maps/api';
import { useMemo } from 'react';
import type { UseGoogleMapsReturn, GoogleMapsLoadState } from '../types/location.types';

// Libraries we need from Google Maps
const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

// Default map center (Arkansas - ATTS area)
export const DEFAULT_CENTER = {
  lat: 35.2010,
  lng: -91.8318,
};

// Default zoom level
export const DEFAULT_ZOOM = 10;

/**
 * Hook to load Google Maps API with Places library
 * 
 * @returns {UseGoogleMapsReturn} Loading state, error info, and API status
 */
export function useGoogleMaps(): UseGoogleMapsReturn {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const isApiKeyMissing = !apiKey || apiKey === 'your-api-key-here';

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
    // Prevent loading if no API key
    preventGoogleFontsLoading: true,
  });

  const loadState = useMemo((): GoogleMapsLoadState => {
    if (isApiKeyMissing) return 'error';
    if (loadError) return 'error';
    if (isLoaded) return 'loaded';
    return 'loading';
  }, [isApiKeyMissing, loadError, isLoaded]);

  return {
    isLoaded: isLoaded && !isApiKeyMissing,
    loadError: isApiKeyMissing 
      ? new Error('Google Maps API key is not configured. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.')
      : loadError || null,
    loadState,
    isApiKeyMissing,
  };
}

/**
 * Map styling for dark theme (matches ATTS portal aesthetic)
 */
export const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2d2d44' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6a6a6a' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#1e1e30' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6a6a6a' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'geometry',
    stylers: [{ color: '#10b981', lightness: -60 }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1a2e1a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2d2d44' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1a2e' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3d3d5c' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1a2e' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2d2d44' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1a2b' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a4a6a' }],
  },
];


