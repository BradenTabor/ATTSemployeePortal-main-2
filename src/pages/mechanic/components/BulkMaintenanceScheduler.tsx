/**
 * Bulk Maintenance Scheduler Component (Phase 3)
 * 
 * Allows mechanics to schedule maintenance for multiple trucks at once.
 * Useful for planning shop time and parts ordering.
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  CheckSquare,
  Square,
  Droplet,
  RefreshCw,
  Circle,
  Loader2,
  CheckCircle2,
  X,
} from 'lucide-react';
import type { VehicleMaintenanceInfo } from '../types/maintenance.types';
import { formatMileage, getUrgencyConfig, MAINTENANCE_TYPE_CONFIG } from '../utils/maintenanceConstants';

// =============================================================================
// TYPES
// =============================================================================

interface BulkMaintenanceSchedulerProps {
  vehicles: VehicleMaintenanceInfo[];
  onSchedule: (scheduleData: ScheduleData) => Promise<void>;
  onClose: () => void;
}

interface ScheduleData {
  trucks: string[];
  maintenanceType: 'oil_change' | 'tire_rotation' | 'tire_replacement';
  scheduledDate: string;
  notes?: string;
}

type MaintenanceOption = 'oil_change' | 'tire_rotation' | 'tire_replacement';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function BulkMaintenanceScheduler({
  vehicles,
  onSchedule,
  onClose,
}: BulkMaintenanceSchedulerProps) {
  const [selectedTrucks, setSelectedTrucks] = useState<Set<string>>(new Set());
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceOption>('oil_change');
  const [scheduledDate, setScheduledDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Filter vehicles that need the selected maintenance type
  const eligibleVehicles = useMemo(() => {
    return vehicles.filter(v => {
      switch (maintenanceType) {
        case 'oil_change':
          return v.oilChangeStatus.urgency !== 'ok';
        case 'tire_rotation':
          return v.tireRotationStatus.urgency !== 'ok';
        case 'tire_replacement':
          return v.tireReplacementStatus.urgency !== 'ok';
      }
    }).sort((a, b) => {
      // Sort by urgency
      const aStatus = maintenanceType === 'oil_change' 
        ? a.oilChangeStatus 
        : maintenanceType === 'tire_rotation'
        ? a.tireRotationStatus
        : a.tireReplacementStatus;
      const bStatus = maintenanceType === 'oil_change' 
        ? b.oilChangeStatus 
        : maintenanceType === 'tire_rotation'
        ? b.tireRotationStatus
        : b.tireReplacementStatus;
      
      const urgencyOrder = { overdue: 0, due_soon: 1, upcoming: 2, ok: 3 };
      return urgencyOrder[aStatus.urgency] - urgencyOrder[bStatus.urgency];
    });
  }, [vehicles, maintenanceType]);
  
  // Handlers
  const toggleTruck = useCallback((truckNumber: string) => {
    setSelectedTrucks(prev => {
      const next = new Set(prev);
      if (next.has(truckNumber)) {
        next.delete(truckNumber);
      } else {
        next.add(truckNumber);
      }
      return next;
    });
  }, []);
  
  const selectAll = useCallback(() => {
    setSelectedTrucks(new Set(eligibleVehicles.map(v => v.truckNumber)));
  }, [eligibleVehicles]);
  
  const selectNone = useCallback(() => {
    setSelectedTrucks(new Set());
  }, []);
  
  const handleSubmit = useCallback(async () => {
    if (selectedTrucks.size === 0) {
      setError('Please select at least one truck');
      return;
    }
    
    if (!scheduledDate) {
      setError('Please select a date');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      await onSchedule({
        trucks: Array.from(selectedTrucks),
        maintenanceType,
        scheduledDate,
        notes: notes.trim() || undefined,
      });
      
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      setError('Failed to schedule. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedTrucks, maintenanceType, scheduledDate, notes, onSchedule, onClose]);
  
  const getMaintenanceIcon = (type: MaintenanceOption) => {
    switch (type) {
      case 'oil_change':
        return Droplet;
      case 'tire_rotation':
        return RefreshCw;
      case 'tire_replacement':
        return Circle;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0503] overflow-hidden shadow-2xl"
      >
        {/* Success Overlay */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 bg-[#0a0503]/95 flex items-center justify-center z-10"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-lg font-semibold text-white">Scheduled!</p>
                <p className="text-sm text-white/50">
                  {selectedTrucks.size} truck{selectedTrucks.size !== 1 ? 's' : ''} scheduled
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#ff9350]/10 to-transparent border-b border-white/5">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#ff9350]" />
            <h2 className="text-base font-semibold text-white">Bulk Schedule</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close scheduler"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Maintenance Type Selector */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">
              Maintenance Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['oil_change', 'tire_rotation', 'tire_replacement'] as const).map((type) => {
                const config = MAINTENANCE_TYPE_CONFIG[type];
                const Icon = getMaintenanceIcon(type);
                const isSelected = maintenanceType === type;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setMaintenanceType(type);
                      setSelectedTrucks(new Set());
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#ff9350] to-[#e87830] text-white shadow-md'
                        : 'bg-black/30 border border-white/10 text-white/60 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {config.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Date Selector */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
              Scheduled Date
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#ff9350]/50 transition-all [color-scheme:dark]"
            />
          </div>
          
          {/* Truck Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-wider text-white/40">
                Select Trucks ({eligibleVehicles.length} need {MAINTENANCE_TYPE_CONFIG[maintenanceType].shortLabel})
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors"
                >
                  All
                </button>
                <span className="text-white/20">|</span>
                <button
                  onClick={selectNone}
                  className="text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors"
                >
                  None
                </button>
              </div>
            </div>
            
            {eligibleVehicles.length === 0 ? (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400/50 mx-auto mb-1" />
                <p className="text-xs text-emerald-300">All trucks are up to date!</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
                {eligibleVehicles.map((vehicle) => {
                  const isSelected = selectedTrucks.has(vehicle.truckNumber);
                  const status = maintenanceType === 'oil_change'
                    ? vehicle.oilChangeStatus
                    : maintenanceType === 'tire_rotation'
                    ? vehicle.tireRotationStatus
                    : vehicle.tireReplacementStatus;
                  const urgencyConfig = getUrgencyConfig(status.urgency);
                  
                  return (
                    <button
                      key={vehicle.truckNumber}
                      onClick={() => toggleTruck(vehicle.truckNumber)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'bg-[#ff9350]/20 border border-[#ff9350]/30'
                          : 'hover:bg-white/[0.03] border border-transparent'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#ff9350] flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-white/30 flex-shrink-0" />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {vehicle.truckNumber}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${urgencyConfig.bgColor} ${urgencyConfig.textColor}`}>
                            {urgencyConfig.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40">
                          {formatMileage(status.milesSinceLast)} mi since last • {status.message}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            
            {selectedTrucks.size > 0 && (
              <p className="text-[10px] text-white/50 mt-1.5">
                {selectedTrucks.size} truck{selectedTrucks.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions..."
              rows={2}
              className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#ff9350]/50 transition-all resize-none"
            />
          </div>
          
          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedTrucks.size === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#ff9350] to-[#e87830] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:shadow-[#ff9350]/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                Schedule {selectedTrucks.size > 0 ? `(${selectedTrucks.size})` : ''}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
