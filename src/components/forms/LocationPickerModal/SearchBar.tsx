/**
 * SearchBar Component
 * 
 * Search input with debouncing and "Use Current Location" button.
 * Part of the LocationPickerModal.
 */

import { Search, MapPin, Loader2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onGetCurrentLocation: () => void;
  isSearching: boolean;
  isGettingLocation: boolean;
  placeholder: string;
  disabled?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onGetCurrentLocation,
  isSearching,
  isGettingLocation,
  placeholder,
  disabled,
}: SearchBarProps) {
  return (
    <div className="space-y-2">
      {/* Search Input - Touch optimized */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/60">
          {isSearching ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Search className="h-5 w-5" />
          )}
        </div>
        
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full rounded-xl border border-white/10 bg-black/60 backdrop-blur-sm",
            "pl-12 pr-12 py-3.5 text-base sm:text-sm text-white placeholder:text-gray-500",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/30",
            "transition-all duration-200",
            "min-h-[48px]", // Touch-friendly height
            disabled && "opacity-50 cursor-not-allowed"
          )}
          aria-label="Search for locations"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          enterKeyHint="search"
        />
        
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2",
              "p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors",
              "min-w-[44px] min-h-[44px] flex items-center justify-center"
            )}
            aria-label="Clear search"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Use Current Location Button - Touch optimized */}
      <button
        type="button"
        onClick={onGetCurrentLocation}
        disabled={disabled || isGettingLocation}
        className={cn(
          "flex items-center gap-2 px-4 py-3 rounded-xl w-full sm:w-auto",
          "text-sm text-emerald-400 hover:text-emerald-300",
          "hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
          "min-h-[44px] justify-center sm:justify-start",
          (disabled || isGettingLocation) && "opacity-50 cursor-not-allowed"
        )}
        aria-label="Use my current location"
      >
        {isGettingLocation ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <MapPin className="h-5 w-5" />
        )}
        <span className="font-medium">
          {isGettingLocation ? 'Getting location...' : 'Use my current location'}
        </span>
      </button>
    </div>
  );
}

