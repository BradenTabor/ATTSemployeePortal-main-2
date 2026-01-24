/**
 * Repair Log Form Component
 * 
 * Form for logging repairs, parts replacements, and maintenance activities.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  Package,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  X,
  DollarSign,
  Calendar,
  FileText,
} from 'lucide-react';
import type { 
  CreateMaintenanceLogInput, 
  MaintenanceType,
  PartUsed,
} from '../types/maintenance.types';
import { 
  MAINTENANCE_TYPE_CONFIG,
  formatMileage,
  normalizeTruckNumber,
} from '../utils/maintenanceConstants';

// =============================================================================
// TYPES
// =============================================================================

interface RepairLogFormProps {
  truckNumber: string;
  currentMileage: number;
  performedByName: string;
  onSubmit: (data: CreateMaintenanceLogInput) => Promise<void>;
  onCancel: () => void;
}

// =============================================================================
// PART INPUT COMPONENT
// =============================================================================

interface PartInputProps {
  part: PartUsed;
  index: number;
  onChange: (index: number, part: PartUsed) => void;
  onRemove: (index: number) => void;
}

function PartInput({ part, index, onChange, onRemove }: PartInputProps) {
  return (
    <div className="flex gap-1.5 sm:gap-2 items-start">
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
        <input
          type="text"
          placeholder="Part name"
          value={part.part_name}
          onChange={(e) => onChange(index, { ...part, part_name: e.target.value })}
          className="col-span-2 sm:col-span-1 bg-black/30 border border-white/10 text-white text-xs sm:text-sm rounded-lg px-2.5 sm:px-3 py-2.5 sm:py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all min-h-[44px] sm:min-h-[38px]"
        />
        <input
          type="number"
          placeholder="Qty"
          min={1}
          value={part.quantity || ''}
          onChange={(e) => onChange(index, { ...part, quantity: parseInt(e.target.value) || 1 })}
          className="bg-black/30 border border-white/10 text-white text-xs sm:text-sm rounded-lg px-2.5 sm:px-3 py-2.5 sm:py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all min-h-[44px] sm:min-h-[38px]"
        />
        <input
          type="text"
          placeholder="Part #"
          value={part.part_number || ''}
          onChange={(e) => onChange(index, { ...part, part_number: e.target.value })}
          className="bg-black/30 border border-white/10 text-white text-xs sm:text-sm rounded-lg px-2.5 sm:px-3 py-2.5 sm:py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all min-h-[44px] sm:min-h-[38px]"
        />
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="p-2.5 sm:p-2 rounded-lg text-red-400/60 hover:text-red-400 active:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 transition-colors min-h-[44px] sm:min-h-[38px]"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function RepairLogForm({
  truckNumber,
  currentMileage,
  performedByName,
  onSubmit,
  onCancel,
}: RepairLogFormProps) {
  // Form state
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>('repair');
  const [description, setDescription] = useState('');
  const [mileageAtService, setMileageAtService] = useState(currentMileage.toString());
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [parts, setParts] = useState<PartUsed[]>([]);
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Handlers
  const handleAddPart = useCallback(() => {
    setParts(prev => [...prev, { part_name: '', quantity: 1, part_number: '' }]);
  }, []);
  
  const handlePartChange = useCallback((index: number, part: PartUsed) => {
    setParts(prev => {
      const newParts = [...prev];
      newParts[index] = part;
      return newParts;
    });
  }, []);
  
  const handlePartRemove = useCallback((index: number) => {
    setParts(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    
    const mileage = parseFloat(mileageAtService);
    if (isNaN(mileage) || mileage < 0) {
      setError('Please enter a valid mileage');
      return;
    }
    
    if (!serviceDate) {
      setError('Please select a service date');
      return;
    }
    
    // Filter out empty parts
    const validParts = parts.filter(p => p.part_name.trim());
    
    try {
      setIsSubmitting(true);
      
      await onSubmit({
        truck_number: normalizeTruckNumber(truckNumber),
        maintenance_type: maintenanceType,
        description: description.trim(),
        parts_used: validParts,
        mileage_at_service: mileage,
        service_date: serviceDate,
        cost: cost ? parseFloat(cost) : undefined,
        notes: notes.trim() || undefined,
        performed_by_name: performedByName,
      });
      
      setShowSuccess(true);
      setTimeout(() => {
        onCancel();
      }, 1500);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    truckNumber, 
    maintenanceType, 
    description, 
    mileageAtService, 
    serviceDate, 
    cost, 
    notes, 
    parts, 
    performedByName, 
    onSubmit,
    onCancel,
  ]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-[#050302] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-amber-500/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-sm font-medium text-white">Log Repair</span>
            <span className="text-xs text-white/50 ml-2">Truck {truckNumber}</span>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close repair form"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Success State */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-[#050302]/95 flex items-center justify-center z-10"
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-lg font-semibold text-white">Repair Logged!</p>
              <p className="text-sm text-white/50">Maintenance schedule updated</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Form */}
      <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Maintenance Type */}
        <div>
          <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1.5 sm:mb-2">
            Maintenance Type
          </label>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {(['oil_change', 'tire_rotation', 'tire_replacement', 'repair', 'part_replacement', 'inspection', 'upgrade', 'other'] as MaintenanceType[]).map((type) => {
              const config = MAINTENANCE_TYPE_CONFIG[type];
              const isSelected = maintenanceType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMaintenanceType(type)}
                  className={`px-1.5 sm:px-2 py-2.5 sm:py-2 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-medium transition-all text-center min-h-[36px] sm:min-h-[32px] ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md'
                      : 'bg-black/30 border border-white/10 text-white/60 hover:text-white active:text-white hover:border-white/20 active:bg-white/5'
                  }`}
                >
                  {config.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Description */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was done? E.g., Replaced front brake pads..."
            rows={2}
            className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all resize-none"
          />
        </div>
        
        {/* Mileage & Date Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
              Mileage at Service *
            </label>
            <div className="relative">
              <input
                type="number"
                value={mileageAtService}
                onChange={(e) => setMileageAtService(e.target.value)}
                placeholder="Current odometer"
                className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg pl-3 pr-10 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">mi</span>
            </div>
            <p className="text-[10px] text-white/30 mt-1">
              Current: {formatMileage(currentMileage)}
            </p>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
              Service Date *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all [color-scheme:dark]"
              />
            </div>
          </div>
        </div>
        
        {/* Cost (Optional) */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Cost (Optional)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="number"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all"
            />
          </div>
        </div>
        
        {/* Parts Used */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-wider text-white/40">
              Parts Used (Optional)
            </label>
            <button
              type="button"
              onClick={handleAddPart}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Part
            </button>
          </div>
          
          {parts.length > 0 && (
            <div className="space-y-2">
              {parts.map((part, index) => (
                <PartInput
                  key={index}
                  part={part}
                  index={index}
                  onChange={handlePartChange}
                  onRemove={handlePartRemove}
                />
              ))}
            </div>
          )}
          
          {parts.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/10 p-3 text-center">
              <Package className="w-5 h-5 text-white/20 mx-auto mb-1" />
              <p className="text-xs text-white/30">No parts added yet</p>
            </div>
          )}
        </div>
        
        {/* Notes */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Additional Notes (Optional)
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 w-4 h-4 text-white/30" />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={2}
              className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all resize-none"
            />
          </div>
        </div>
        
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs font-medium text-red-300"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Actions */}
        <div className="flex gap-2 sm:gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 sm:px-4 py-3 sm:py-2.5 rounded-lg border border-white/10 text-white/70 text-xs sm:text-sm font-medium hover:bg-white/5 active:bg-white/10 transition-colors min-h-[44px] sm:min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3 sm:px-4 py-3 sm:py-2.5 text-xs sm:text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:shadow-amber-500/20 min-h-[44px] sm:min-h-[40px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Save </span>Repair
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
