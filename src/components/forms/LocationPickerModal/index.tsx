/**
 * LocationPickerModal Component
 * 
 * Full-featured location picker with Google Maps, search, and selection.
 * Accessible, mobile-friendly, with graceful error handling.
 */

import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';
import { useLocationPicker } from '../../../hooks/useLocationPicker';
import { useModalOverlay } from '../../../hooks/useModalOverlay';
import { getSearchPlaceholder, getModalTitle } from '../../../utils/formatLocation';
import type { LocationPickerModalProps } from '../../../types/location.types';

import { SearchBar } from './SearchBar';
import { MapView } from './MapView';
import { ResultsList } from './ResultsList';

export function LocationPickerModal({
  isOpen,
  onClose,
  onSelect,
  locationType,
}: Omit<LocationPickerModalProps, 'initialValue'>) {
  const { modalRef, zIndex } = useModalOverlay({ isOpen, onClose, zIndex: 100 });
  const { isLoaded, loadError, isApiKeyMissing } = useGoogleMaps();

  const {
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
    getCurrentLocation,
  } = useLocationPicker({
    locationType,
    onSelect: (value) => {
      onSelect({
        placeId: selectedLocation?.placeId || '',
        name: selectedLocation?.name || '',
        address: selectedLocation?.address || '',
        formattedValue: value,
        coordinates: selectedLocation?.coordinates || { lat: 0, lng: 0 },
        type: locationType,
      });
      onClose();
    },
  });

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    confirmSelection();
  }, [confirmSelection]);

  const title = getModalTitle(locationType);
  const placeholder = getSearchPlaceholder(locationType);

  if (!isOpen) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-6"
        style={{ zIndex }}
        onClick={handleBackdropClick}
        aria-hidden
      >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal - Full screen on mobile, centered modal on desktop */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-picker-title"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full overflow-hidden",
              "bg-gradient-to-b from-gray-900/95 to-black/95",
              "border-t sm:border border-white/10",
              "rounded-t-2xl sm:rounded-2xl shadow-2xl",
              "flex flex-col",
              // Full height on mobile (sheet-style), constrained on desktop
              "h-[92vh] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl"
            )}
          >
            {/* Header with drag handle on mobile */}
            <div className="flex flex-col border-b border-white/10">
              {/* Mobile drag indicator */}
              <div className="flex justify-center py-2 sm:hidden">
                <div className="w-12 h-1.5 rounded-full bg-white/20" />
              </div>
              
              <div className="flex items-center justify-between px-4 py-2 sm:py-3">
                <h2
                  id="location-picker-title"
                  className="text-lg font-semibold text-white"
                >
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "p-3 -mr-1 rounded-xl text-gray-400 hover:text-white",
                    "hover:bg-white/10 active:bg-white/20 transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
                    "min-w-[44px] min-h-[44px] flex items-center justify-center"
                  )}
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
              {/* API Error State */}
              {(loadError || isApiKeyMissing) && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-200">
                      {isApiKeyMissing
                        ? 'Google Maps API key not configured. You can still enter locations manually.'
                        : 'Unable to load Google Maps. You can still enter locations manually.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onGetCurrentLocation={getCurrentLocation}
                isSearching={isSearching}
                isGettingLocation={isGettingLocation}
                placeholder={placeholder}
                disabled={!isLoaded}
              />

              {/* Map and Results Grid - Mobile optimized layout */}
              <div className="flex-1 flex flex-col sm:grid sm:grid-cols-2 gap-3 sm:gap-4 min-h-0 overflow-hidden">
                {/* Map - Smaller on mobile, equal on desktop */}
                <div className="h-[180px] sm:h-full flex-shrink-0 rounded-xl overflow-hidden border border-white/10">
                  <MapView
                    results={results}
                    selectedLocation={selectedLocation}
                    userLocation={userLocation}
                    onSelectLocation={selectLocation}
                    isLoaded={isLoaded}
                  />
                </div>

                {/* Results List - Scrollable on mobile */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ResultsList
                    results={results}
                    recentLocations={recentLocations}
                    selectedLocation={selectedLocation}
                    onSelectLocation={selectLocation}
                    isSearching={isSearching}
                    error={error}
                    showRecent={!searchQuery}
                  />
                </div>
              </div>
            </div>

            {/* Footer - Safe area padding for mobile */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-black/30">
              {/* Selected location preview - Hidden on very small screens */}
              <div className="hidden sm:block flex-1 min-w-0">
                {selectedLocation ? (
                  <p className="text-sm text-emerald-300 truncate">
                    {selectedLocation.name}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">
                    Select a location from the list or map
                  </p>
                )}
              </div>

              {/* Actions - Full width buttons on mobile */}
              <div className="flex items-center gap-2 sm:gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "flex-1 sm:flex-none px-4 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium",
                    "text-gray-300 hover:text-white",
                    "hover:bg-white/10 active:bg-white/20 transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                    "min-h-[44px]"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!selectedLocation}
                  className={cn(
                    "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium",
                    "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white",
                    "transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600",
                    "min-h-[44px]"
                  )}
                  aria-label="Confirm selection"
                >
                  <Check className="h-4 w-4" />
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

export default LocationPickerModal;

