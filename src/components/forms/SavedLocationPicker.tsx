/**
 * SavedLocationPicker Component
 * 
 * A horizontal chip picker for user's saved work locations.
 * Selecting a location auto-fills work location, hospital, clinic, and circuit.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Plus,
  Star,
  Check,
  X,
  Loader2,
  Trash2,
  Settings,
  Navigation,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUserSavedLocations, type SavedLocation } from '../../hooks/user';

// =============================================================================
// TYPES
// =============================================================================

interface SavedLocationPickerProps {
  /** Current form location values */
  currentValues: {
    workLocation: string;
    nearestHospital: string;
    nearestClinic: string;
    circuitNumber: string;
  };
  /** Callback when a location is applied */
  onApply: (values: {
    workLocation: string;
    nearestHospital: string;
    nearestClinic: string;
    circuitNumber: string;
  }) => void;
  /** Optional className */
  className?: string;
}

// =============================================================================
// SAVE LOCATION MODAL
// =============================================================================

interface SaveLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  currentAddress: string;
  isSaving: boolean;
}

function SaveLocationModal({
  isOpen,
  onClose,
  onSave,
  currentAddress,
  isSaving,
}: SaveLocationModalProps) {
  const [name, setName] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave(name.trim());
    setName('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-[#0a1a10] to-black p-5 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/20">
                <MapPin className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="font-semibold text-white">Save Location</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Current Address Preview */}
          <div className="mb-4 p-3 rounded-lg border border-white/10 bg-black/30">
            <p className="text-[10px] text-gray-500 uppercase mb-1">Address</p>
            <p className="text-sm text-white">{currentAddress || 'No address entered'}</p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide">
                Location Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Downtown Site, Highway 65 Job"
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                autoFocus
              />
              <p className="mt-1 text-[10px] text-gray-500">
                Hospital, clinic, and circuit will also be saved
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-5">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-white/70 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                name.trim() && !isSaving
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-emerald-600/30 text-white/50 cursor-not-allowed"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Star className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SavedLocationPicker({
  currentValues,
  onApply,
  className,
}: SavedLocationPickerProps) {
  const {
    locations,
    isLoading,
    saveLocation,
    recordUsage,
    deleteLocation,
    isAddressSaved,
  } = useUserSavedLocations();

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [appliedLocationId, setAppliedLocationId] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);

  // Check if current location has values worth saving
  const hasLocationToSave = currentValues.workLocation.trim() && !isAddressSaved(currentValues.workLocation);

  const handleApplyLocation = async (location: SavedLocation) => {
    if (showManage) return;

    onApply({
      workLocation: location.address,
      nearestHospital: location.nearest_hospital || '',
      nearestClinic: location.nearest_clinic || '',
      circuitNumber: location.circuit_number || '',
    });

    setAppliedLocationId(location.id);
    await recordUsage(location.id);

    // Clear applied indicator after 2 seconds
    setTimeout(() => setAppliedLocationId(null), 2000);
  };

  const handleSaveLocation = async (name: string) => {
    setIsSaving(true);
    try {
      await saveLocation({
        name,
        address: currentValues.workLocation,
        nearest_hospital: currentValues.nearestHospital,
        nearest_clinic: currentValues.nearestClinic,
        circuit_number: currentValues.circuitNumber,
      });
      setShowSaveModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLocation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this saved location?')) {
      await deleteLocation(id);
    }
  };

  // Don't render if loading
  if (isLoading) {
    return (
      <div className={cn("mb-3", className)}>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading saved locations...
        </div>
      </div>
    );
  }

  // Show nothing if no saved locations and no location to save
  if (locations.length === 0 && !hasLocationToSave) {
    return null;
  }

  return (
    <div className={cn("mb-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-3.5 h-3.5 text-emerald-500/70" />
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Saved Locations
          </p>
        </div>
        {locations.length > 0 && (
          <button
            onClick={() => setShowManage(!showManage)}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            <Settings className="w-3 h-3" />
            {showManage ? 'Done' : 'Manage'}
          </button>
        )}
      </div>

      {/* Location Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {locations.map((location) => (
          <motion.button
            key={location.id}
            type="button"
            onClick={() => handleApplyLocation(location)}
            whileTap={!showManage ? { scale: 0.95 } : undefined}
            className={cn(
              "relative flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-medium transition-all touch-manipulation max-w-[160px]",
              appliedLocationId === location.id
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-white/10 bg-black/30 text-white/70 hover:bg-white/10"
            )}
          >
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {appliedLocationId === location.id && <Check className="w-3 h-3 flex-shrink-0" />}
              <span className="truncate">{location.name}</span>
            </span>

            {/* Delete button (visible in manage mode) */}
            {showManage && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => handleDeleteLocation(location.id, e)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </motion.button>
            )}
          </motion.button>
        ))}

        {/* Save Current Button */}
        {hasLocationToSave && (
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            className="flex-shrink-0 px-3 py-2 rounded-lg border border-dashed border-white/20 text-xs text-white/50 hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" />
            Save Current
          </button>
        )}
      </div>

      {/* Helper text */}
      {locations.length === 0 && hasLocationToSave && (
        <p className="text-[10px] text-gray-500 mt-1">
          Save this location for quick access next time
        </p>
      )}

      {/* Save Location Modal */}
      <SaveLocationModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveLocation}
        currentAddress={currentValues.workLocation}
        isSaving={isSaving}
      />
    </div>
  );
}

export default SavedLocationPicker;
