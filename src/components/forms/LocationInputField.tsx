/**
 * LocationInputField Component
 * 
 * Enhanced input field with map picker button for selecting
 * hospitals and clinics from Google Maps.
 */

import { useState } from 'react';
import { MapPin, Map } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LocationType } from '../../types/location.types';
import { LocationPickerModal } from './LocationPickerModal';

interface LocationInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locationType: LocationType;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function LocationInputField({
  label,
  value,
  onChange,
  locationType,
  placeholder,
  required,
  className,
}: LocationInputFieldProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSelectLocation = (location: { formattedValue: string }) => {
    onChange(location.formattedValue);
    setIsModalOpen(false);
  };

  return (
    <>
      <div className={className}>
        <label className="block text-[11px] font-medium text-white/70 mb-1 uppercase tracking-wide">
          {label}
          {required && <span className="text-emerald-400 ml-0.5">*</span>}
        </label>
        <div className="relative flex gap-2">
          {/* Input field */}
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500/50" />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              required={required}
              className={cn(
                "w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white",
                "placeholder:text-gray-500 focus:outline-none focus:ring-1",
                "focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all",
                "pl-9"
              )}
            />
          </div>

          {/* Map picker button */}
          <button
            type="button"
            onClick={handleOpenModal}
            className={cn(
              "flex items-center justify-center",
              "w-11 h-11 min-w-[44px] min-h-[44px]", // 44x44px touch target
              "rounded-lg border border-white/10 bg-black/50",
              "text-emerald-500/70 hover:text-emerald-400",
              "hover:bg-emerald-500/10 hover:border-emerald-500/30",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            )}
            aria-label={`Open map to select ${locationType}`}
            title={`Search for ${locationType} on map`}
          >
            <Map className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-gray-500">
          Type manually or click the map icon to search
        </p>
      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSelect={handleSelectLocation}
        locationType={locationType}
      />
    </>
  );
}

