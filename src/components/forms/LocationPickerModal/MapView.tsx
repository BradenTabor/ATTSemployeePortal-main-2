/**
 * MapView Component
 * 
 * Google Map display with markers for search results.
 * Part of the LocationPickerModal.
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { DEFAULT_CENTER, DEFAULT_ZOOM, darkMapStyles } from '../../../hooks/useGoogleMaps';
import type { PlaceLocation, LocationCoordinates } from '../../../types/location.types';

interface MapViewProps {
  results: PlaceLocation[];
  selectedLocation: PlaceLocation | null;
  userLocation: LocationCoordinates | null;
  onSelectLocation: (location: PlaceLocation) => void;
  isLoaded: boolean;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.75rem',
};

const mapOptions: google.maps.MapOptions = {
  styles: darkMapStyles,
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: 'greedy',
};

// Helper to check if coordinates are valid (not default 0,0)
function hasValidCoordinates(coords: LocationCoordinates | undefined | null): boolean {
  if (!coords) return false;
  return coords.lat !== 0 || coords.lng !== 0;
}

export function MapView({
  results,
  selectedLocation,
  userLocation,
  onSelectLocation,
  isLoaded,
}: MapViewProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const lastResultsLength = useRef(0);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Filter results with valid coordinates
  const resultsWithCoords = results.filter(r => hasValidCoordinates(r.coordinates));

  // Calculate center based on selection, results, or user location
  const center = hasValidCoordinates(selectedLocation?.coordinates)
    ? selectedLocation!.coordinates
    : resultsWithCoords.length > 0
    ? resultsWithCoords[0].coordinates
    : userLocation
    ? userLocation
    : DEFAULT_CENTER;

  // Fit bounds to show all markers when results change
  useEffect(() => {
    if (!map || resultsWithCoords.length === 0) return;
    
    // Only fit bounds when we get new results
    if (resultsWithCoords.length === lastResultsLength.current) return;
    lastResultsLength.current = resultsWithCoords.length;

    const bounds = new google.maps.LatLngBounds();
    
    resultsWithCoords.forEach((loc) => {
      bounds.extend(loc.coordinates);
    });

    if (userLocation) {
      bounds.extend(userLocation);
    }

    // Add a small delay to ensure map is ready
    setTimeout(() => {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }, 100);
  }, [map, resultsWithCoords, userLocation]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full rounded-xl bg-black/40 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading map...</div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={selectedLocation ? 15 : DEFAULT_ZOOM}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={mapOptions}
    >
      {/* User location marker */}
      {userLocation && (
        <Marker
          position={userLocation}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }}
          title="Your location"
          zIndex={1000}
        />
      )}

      {/* Result markers - only show those with valid coordinates */}
      {resultsWithCoords.map((location, index) => {
        const isSelected = selectedLocation?.placeId === location.placeId;
        
        return (
          <Marker
            key={location.placeId || index}
            position={location.coordinates}
            onClick={() => onSelectLocation(location)}
            icon={{
              path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: isSelected ? 8 : 6,
              fillColor: isSelected ? '#10b981' : '#6b7280',
              fillOpacity: 1,
              strokeColor: isSelected ? '#ffffff' : '#9ca3af',
              strokeWeight: isSelected ? 2 : 1,
              rotation: 0,
            }}
            title={location.name}
            animation={isSelected ? google.maps.Animation.BOUNCE : undefined}
            zIndex={isSelected ? 999 : index}
          />
        );
      })}
    </GoogleMap>
  );
}

