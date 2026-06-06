/**
 * ResultsList Component
 * 
 * Scrollable list of search results with keyboard navigation.
 * Part of the LocationPickerModal.
 */

import { useRef, useEffect } from 'react';
import { MapPin, Star, Clock, Building2, MapPinOff, Search, ArrowUp } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { PlaceLocation } from '../../../types/location.types';

interface ResultsListProps {
  results: PlaceLocation[];
  recentLocations: PlaceLocation[];
  selectedLocation: PlaceLocation | null;
  onSelectLocation: (location: PlaceLocation) => void;
  isSearching: boolean;
  error: string | null;
  showRecent: boolean;
}

// Check if error is a location permission denial
function isPermissionDeniedError(error: string | null): boolean {
  return error?.toLowerCase().includes('permission denied') || false;
}

export function ResultsList({
  results,
  recentLocations,
  selectedLocation,
  onSelectLocation,
  isSearching,
  error,
  showRecent,
}: ResultsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedLocation]);

  // Show recent locations when no search
  const displayResults = showRecent && results.length === 0 && !error
    ? recentLocations
    : results;

  const isShowingRecent = showRecent && results.length === 0 && recentLocations.length > 0 && !error;

  if (isSearching) {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-sm">Searching...</span>
        </div>
      </div>
    );
  }

  // Special handling for permission denied errors - more helpful UX
  if (error && isPermissionDeniedError(error)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 gap-4">
        {/* Permission denied notice */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <MapPinOff className="h-6 w-6 text-amber-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-200">Location Access Blocked</p>
            <p className="text-xs text-gray-400 max-w-[200px]">
              Enable in browser settings or search below
            </p>
          </div>
        </div>

        {/* Search prompt with animated arrow */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Search className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-emerald-300 font-medium">
              Search for a hospital or clinic
            </span>
          </div>
          <ArrowUp className="h-4 w-4 text-emerald-400/60 animate-bounce" />
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">
            Type above to search
          </p>
        </div>
      </div>
    );
  }

  // Standard error display
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <MapPin className="h-8 w-8 text-gray-500" />
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (displayResults.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <Building2 className="h-8 w-8 text-gray-500" />
          <p className="text-sm text-gray-400">
            Search for a location above or use your current location
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={cn(
        "h-full overflow-y-auto space-y-1.5 sm:space-y-1 pr-1",
        "overscroll-contain", // Prevent scroll chaining
        "-webkit-overflow-scrolling: touch" // Smooth scroll on iOS
      )}
      role="listbox"
      aria-label="Location search results"
    >
      {isShowingRecent && (
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium px-2 py-1.5">
          Recent Selections
        </p>
      )}
      
      {displayResults.map((location, index) => {
        const isSelected = selectedLocation?.placeId === location.placeId;
        
        return (
          <button
            key={location.placeId || index}
            ref={isSelected ? selectedRef : null}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelectLocation(location)}
            className={cn(
              "w-full text-left p-3 sm:p-3 rounded-xl sm:rounded-lg transition-all duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
              "hover:bg-white/5 active:bg-white/10",
              "min-h-[56px]", // Touch-friendly minimum height
              isSelected
                ? "bg-emerald-500/20 border border-emerald-500/30"
                : "bg-black/20 border border-transparent"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "flex-shrink-0 mt-0.5 p-2 rounded-xl sm:rounded-lg",
                isSelected ? "bg-emerald-500/30" : "bg-white/5"
              )}>
                <MapPin className={cn(
                  "h-5 w-5 sm:h-4 sm:w-4",
                  isSelected ? "text-emerald-400" : "text-gray-400"
                )} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-sm truncate",
                  isSelected ? "text-emerald-300" : "text-white"
                )}>
                  {location.name}
                </p>
                <p className="text-xs text-gray-400 truncate mt-0.5 sm:mt-0.5">
                  {location.address}
                </p>
                
                {/* Additional info */}
                <div className="flex items-center gap-3 mt-1.5 sm:mt-1.5">
                  {location.rating && (
                    <span className="flex items-center gap-1 text-[11px] sm:text-[10px] text-amber-400">
                      <Star className="h-3.5 w-3.5 sm:h-3 sm:w-3 fill-current" />
                      {location.rating.toFixed(1)}
                    </span>
                  )}
                  {location.isOpen !== undefined && (
                    <span className={cn(
                      "flex items-center gap-1 text-[11px] sm:text-[10px]",
                      location.isOpen ? "text-emerald-400" : "text-red-400"
                    )}>
                      <Clock className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                      {location.isOpen ? 'Open' : 'Closed'}
                    </span>
                  )}
                </div>
              </div>
              
              {isSelected && (
                <div className="flex-shrink-0 self-center">
                  <div className="w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              )}
            </div>
          </button>
        );
      })}
      
      {/* Aria live region for screen readers */}
      <div className="sr-only" aria-live="polite">
        {displayResults.length} results found
      </div>
    </div>
  );
}

