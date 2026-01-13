/**
 * Location Formatting Utilities
 * 
 * Helper functions for formatting and parsing location data
 * for the Google Maps Location Picker.
 */

import type { PlaceLocation, LocationType, RecentLocation, LocationCoordinates } from '../types/location.types';
import { LOCATION_CACHE_KEY, MAX_RECENT_LOCATIONS } from '../types/location.types';

/**
 * Format a PlaceLocation into a display string: "Name - Address"
 */
export function formatLocationString(location: PlaceLocation): string {
  if (!location.name && !location.address) {
    return '';
  }
  if (!location.address) {
    return location.name;
  }
  if (!location.name) {
    return location.address;
  }
  return `${location.name} - ${location.address}`;
}

/**
 * Parse a formatted location string back to name and address
 * Returns null if parsing fails
 */
export function parseLocationString(value: string): { name: string; address: string } | null {
  if (!value || !value.includes(' - ')) {
    return null;
  }
  const [name, ...addressParts] = value.split(' - ');
  return {
    name: name.trim(),
    address: addressParts.join(' - ').trim(),
  };
}

/**
 * Get Place types for Google Places API based on location type
 * These must be valid Google Places types from:
 * https://developers.google.com/maps/documentation/places/web-service/supported_types
 */
export function getPlaceTypes(locationType: LocationType): string[] {
  switch (locationType) {
    case 'hospital':
      // 'hospital' is a valid Google Place type
      return ['hospital'];
    case 'clinic':
      // 'doctor' covers clinics, urgent care, medical offices
      return ['doctor'];
    default:
      return ['hospital'];
  }
}

/**
 * Get keyword for text search (more flexible than type filtering)
 */
export function getSearchKeyword(locationType: LocationType): string {
  switch (locationType) {
    case 'hospital':
      return 'hospital emergency room';
    case 'clinic':
      return 'urgent care clinic medical center';
    default:
      return 'medical facility';
  }
}

/**
 * Get search placeholder text based on location type
 */
export function getSearchPlaceholder(locationType: LocationType): string {
  switch (locationType) {
    case 'hospital':
      return 'Search for hospitals...';
    case 'clinic':
      return 'Search for clinics or medical centers...';
    default:
      return 'Search for locations...';
  }
}

/**
 * Get modal title based on location type
 */
export function getModalTitle(locationType: LocationType): string {
  switch (locationType) {
    case 'hospital':
      return 'Select Nearest Hospital';
    case 'clinic':
      return 'Select Nearest Clinic';
    default:
      return 'Select Location';
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in miles
 */
export function calculateDistance(
  coord1: LocationCoordinates,
  coord2: LocationCoordinates
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return 'Nearby';
  }
  if (miles < 1) {
    return `${Math.round(miles * 10) / 10} mi`;
  }
  return `${Math.round(miles)} mi`;
}

// =============================================================================
// Recent Locations Cache (localStorage)
// =============================================================================

/**
 * Get recent locations from localStorage
 */
export function getRecentLocations(locationType?: LocationType): RecentLocation[] {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return [];
    
    const locations: RecentLocation[] = JSON.parse(cached);
    
    // Filter by type if specified
    if (locationType) {
      return locations.filter(l => l.locationType === locationType);
    }
    
    return locations;
  } catch {
    return [];
  }
}

/**
 * Add a location to recent locations cache
 */
export function addRecentLocation(location: PlaceLocation, locationType: LocationType): void {
  try {
    const existing = getRecentLocations();
    
    // Remove duplicate if exists
    const filtered = existing.filter(l => l.location.placeId !== location.placeId);
    
    // Add new location at the beginning
    const newEntry: RecentLocation = {
      location,
      timestamp: Date.now(),
      locationType,
    };
    
    const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_LOCATIONS);
    
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Clear all recent locations
 */
export function clearRecentLocations(): void {
  try {
    localStorage.removeItem(LOCATION_CACHE_KEY);
  } catch {
    // Silently fail
  }
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Check if a string looks like a valid location (has both name and address)
 */
export function isValidLocationString(value: string): boolean {
  if (!value || value.trim().length < 3) {
    return false;
  }
  // A proper formatted location should have " - " separator
  // But we also allow manual entries
  return true;
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinates(coords: LocationCoordinates | null | undefined): boolean {
  if (!coords) return false;
  return (
    typeof coords.lat === 'number' &&
    typeof coords.lng === 'number' &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lng >= -180 &&
    coords.lng <= 180
  );
}

