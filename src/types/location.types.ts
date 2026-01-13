/**
 * Location Types for Google Maps Location Picker
 * 
 * Used by the LocationPickerModal component for hospital/clinic selection
 * in the Daily JSA form.
 */

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface PlaceLocation {
  placeId: string;
  name: string;
  address: string;
  formattedValue: string; // "Name - Address" format for input field
  coordinates: LocationCoordinates;
  type: LocationType;
  phoneNumber?: string;
  rating?: number;
  isOpen?: boolean;
}

export type LocationType = 'hospital' | 'clinic';

export interface LocationPickerState {
  isOpen: boolean;
  searchQuery: string;
  results: PlaceLocation[];
  selectedLocation: PlaceLocation | null;
  isLoading: boolean;
  error: string | null;
}

export interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: PlaceLocation) => void;
  locationType: LocationType;
  initialValue?: string;
  initialCoordinates?: LocationCoordinates;
}

export interface LocationInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locationType: LocationType;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

// Google Maps API loading states
export type GoogleMapsLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface UseGoogleMapsReturn {
  isLoaded: boolean;
  loadError: Error | null;
  loadState: GoogleMapsLoadState;
  isApiKeyMissing: boolean;
}

// Recent locations cache
export interface RecentLocation {
  location: PlaceLocation;
  timestamp: number;
  locationType: LocationType;
}

export const LOCATION_CACHE_KEY = 'atts-recent-locations';
export const MAX_RECENT_LOCATIONS = 5;

