/**
 * useLocationPicker Hook
 * 
 * Manages location picker state, search debouncing, and recent locations cache.
 * Used by LocationPickerModal for form integration.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PlaceLocation, LocationType, LocationCoordinates } from '../types/location.types';
import { 
  formatLocationString, 
  getRecentLocations, 
  addRecentLocation,
  getPlaceTypes,
  getSearchKeyword,
} from '../utils/formatLocation';

const DEBOUNCE_MS = 300;

interface UseLocationPickerOptions {
  locationType: LocationType;
  onSelect: (formattedValue: string) => void;
  initialCoordinates?: LocationCoordinates;
}

interface UseLocationPickerReturn {
  // State
  searchQuery: string;
  results: PlaceLocation[];
  selectedLocation: PlaceLocation | null;
  isSearching: boolean;
  error: string | null;
  recentLocations: PlaceLocation[];
  userLocation: LocationCoordinates | null;
  isGettingLocation: boolean;
  
  // Actions
  setSearchQuery: (query: string) => void;
  selectLocation: (location: PlaceLocation) => void;
  confirmSelection: () => void;
  clearSelection: () => void;
  getCurrentLocation: () => void;
  searchNearby: (center: LocationCoordinates) => void;
}

export function useLocationPicker({
  locationType,
  onSelect,
  initialCoordinates,
}: UseLocationPickerOptions): UseLocationPickerReturn {
  // State
  const [searchQuery, setSearchQueryState] = useState('');
  const [results, setResults] = useState<PlaceLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<PlaceLocation | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(initialCoordinates || null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Refs
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const performSearchRef = useRef<((query: string) => void) | null>(null);

  // Load recent locations
  const recentLocations = getRecentLocations(locationType).map(r => r.location);

  // Initialize Google services when available
  useEffect(() => {
    const initGoogleServices = () => {
      if (typeof window !== 'undefined' && typeof window.google !== 'undefined' && window.google.maps?.places) {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        // PlacesService needs a map or div element
        const div = document.createElement('div');
        placesService.current = new window.google.maps.places.PlacesService(div);
        sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
        console.log('[LocationPicker] Google Places services initialized successfully');
        return true;
      }
      return false;
    };

    // Try to initialize immediately
    if (initGoogleServices()) return;

    // If not available, poll for it (Google Maps loads asynchronously)
    console.log('[LocationPicker] Google Maps not ready, waiting...');
    const interval = setInterval(() => {
      if (initGoogleServices()) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Debounced search
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    setError(null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceTimer.current = setTimeout(() => {
      performSearchRef.current?.(query);
    }, DEBOUNCE_MS);
  }, []);

  // Perform autocomplete search
  const performSearch = useCallback((query: string) => {
    if (!autocompleteService.current || !query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    try {
      // Add location type keyword to improve results
      const searchQuery = locationType === 'hospital' 
        ? `${query} hospital` 
        : `${query} clinic medical`;
      
      const request: google.maps.places.AutocompletionRequest = {
        input: searchQuery,
        // Use 'establishment' type to get business results
        types: ['establishment'],
        sessionToken: sessionToken.current || undefined,
        locationBias: userLocation 
          ? new google.maps.Circle({
              center: userLocation,
              radius: 80467, // 50 miles in meters
            })
          : undefined,
      };

      autocompleteService.current.getPlacePredictions(
        request,
        (predictions, status) => {
          setIsSearching(false);

          if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            setResults([]);
            setError('No results found. Try a different search term.');
            return;
          }

          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
            setError(`Search failed: ${status}. Make sure Places API is enabled in Google Cloud Console.`);
            return;
          }

          // Convert predictions to PlaceLocation format
          const locations: PlaceLocation[] = predictions.slice(0, 6).map(pred => ({
            placeId: pred.place_id,
            name: pred.structured_formatting.main_text,
            address: pred.structured_formatting.secondary_text || '',
            formattedValue: formatLocationString({
              placeId: pred.place_id,
              name: pred.structured_formatting.main_text,
              address: pred.structured_formatting.secondary_text || '',
              formattedValue: '',
              coordinates: { lat: 0, lng: 0 },
              type: locationType,
            }),
            coordinates: { lat: 0, lng: 0 }, // Will be fetched on selection
            type: locationType,
          }));

          setResults(locations);
          setError(null);
        }
      );
    } catch {
      setIsSearching(false);
      setError('Search failed. Please try again.');
    }
  }, [locationType, userLocation]);

  // Keep ref in sync with performSearch
  useEffect(() => {
    performSearchRef.current = performSearch;
  }, [performSearch]);

  // Search nearby (for "Use Current Location" button)
  const searchNearby = useCallback((center: LocationCoordinates) => {
    if (!placesService.current) {
      setError('Google Places service not ready. Please try again.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]); // Clear previous results

    // Use textSearch for better results with keywords
    const keyword = getSearchKeyword(locationType);
    
    const request: google.maps.places.TextSearchRequest = {
      query: keyword,
      location: center,
      radius: 32187, // 20 miles in meters - reasonable range for finding hospitals/clinics
    };

    placesService.current.textSearch(request, (results, status) => {
      setIsSearching(false);

      console.log('[LocationPicker] Nearby search status:', status, 'Results:', results?.length || 0);

      if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS || !results || results.length === 0) {
        // Try fallback with nearbySearch if textSearch returns no results
        const fallbackRequest: google.maps.places.PlaceSearchRequest = {
          location: center,
          radius: 48280, // 30 miles fallback
          type: getPlaceTypes(locationType)[0],
        };

        placesService.current?.nearbySearch(fallbackRequest, (fallbackResults, fallbackStatus) => {
          if (fallbackStatus === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS || !fallbackResults) {
            setResults([]);
            setError(`No ${locationType}s found within 30 miles. Try searching manually.`);
            return;
          }

          if (fallbackStatus !== window.google.maps.places.PlacesServiceStatus.OK) {
            setError(`Search failed (${fallbackStatus}). Please try searching manually.`);
            return;
          }

          processResults(fallbackResults);
        });
        return;
      }

      if (status !== window.google.maps.places.PlacesServiceStatus.OK) {
        setError(`Search failed (${status}). Make sure Places API is enabled.`);
        return;
      }

      processResults(results);
    });

    function processResults(results: google.maps.places.PlaceResult[]) {
      // Filter and format results
      const locations: PlaceLocation[] = results
        .filter(place => place.place_id && place.name && place.geometry?.location)
        .slice(0, 8) // Show up to 8 results
        .map(place => ({
          placeId: place.place_id!,
          name: place.name!,
          address: place.formatted_address || place.vicinity || '',
          formattedValue: `${place.name} - ${place.formatted_address || place.vicinity || ''}`,
          coordinates: {
            lat: place.geometry!.location!.lat(),
            lng: place.geometry!.location!.lng(),
          },
          type: locationType,
          rating: place.rating,
          isOpen: place.opening_hours?.isOpen?.(),
        }));

      if (locations.length === 0) {
        setError(`No ${locationType}s found nearby. Try searching manually.`);
      } else {
        setResults(locations);
        setError(null);
      }
    }
  }, [locationType]);

  // Select a location (get full details)
  const selectLocation = useCallback((location: PlaceLocation) => {
    setSelectedLocation(location);
    setError(null);

    // If we don't have coordinates, fetch place details
    if (location.coordinates.lat === 0 && placesService.current) {
      const request: google.maps.places.PlaceDetailsRequest = {
        placeId: location.placeId,
        fields: ['geometry', 'formatted_address', 'name', 'formatted_phone_number', 'rating', 'opening_hours'],
        sessionToken: sessionToken.current || undefined,
      };

      placesService.current.getDetails(request, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          const updatedLocation: PlaceLocation = {
            ...location,
            address: place.formatted_address || location.address,
            formattedValue: `${place.name || location.name} - ${place.formatted_address || location.address}`,
            coordinates: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
            },
            phoneNumber: place.formatted_phone_number,
            rating: place.rating,
            isOpen: place.opening_hours?.isOpen?.(),
          };
          setSelectedLocation(updatedLocation);
          
          // Reset session token after getting details
          sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
        }
      });
    }
  }, []);

  // Confirm selection and update form
  const confirmSelection = useCallback(() => {
    if (!selectedLocation) return;

    // Add to recent locations cache
    addRecentLocation(selectedLocation, locationType);

    // Call the onSelect callback with formatted value
    onSelect(selectedLocation.formattedValue);
  }, [selectedLocation, locationType, onSelect]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedLocation(null);
  }, []);

  // Get user's current location
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setIsGettingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: LocationCoordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setIsGettingLocation(false);
        
        // Automatically search nearby
        searchNearby(coords);
      },
      (err) => {
        setIsGettingLocation(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable. Please try again.');
            break;
          case err.TIMEOUT:
            setError('Location request timed out. Please try again.');
            break;
          default:
            setError('Could not get your location. Please search manually.');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  }, [searchNearby]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    searchQuery,
    results,
    selectedLocation,
    isSearching,
    error,
    recentLocations,
    userLocation,
    isGettingLocation,
    setSearchQuery,
    selectLocation,
    confirmSelection,
    clearSelection,
    getCurrentLocation,
    searchNearby,
  };
}

