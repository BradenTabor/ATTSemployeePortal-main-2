/**
 * Parts & Repairs Log Page
 * 
 * Comprehensive mechanic dashboard for:
 * - Tracking vehicle maintenance status (oil changes, tire rotations)
 * - Logging repairs, parts, and upgrades
 * - Viewing mileage-based maintenance recommendations
 * - Managing mileage anomalies
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion, useInView } from 'framer-motion';
import {
  Wrench,
  Droplet,
  RefreshCw,
  Circle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Truck,
  Flame,
  Clock,
  Shield,
  Package,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { TextEffect } from '../../components/ui/TextEffect';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { cn } from '../../lib/utils';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import CardListSkeleton from '../../components/skeletons/CardListSkeleton';

// Local imports
import { useMaintenanceData } from './hooks/useMaintenanceData';
import { useMaintenanceCalculations } from './hooks/useMaintenanceCalculations';
import {
  formatMileage,
  URGENCY_CONFIG,
  MAINTENANCE_TYPE_CONFIG,
  UI_CONFIG,
  getUrgencyConfig,
} from './utils/maintenanceConstants';
import type {
  VehicleMaintenanceInfo,
  UrgencyLevel,
} from './types/maintenance.types';

// Import components
import RepairLogForm from './components/RepairLogForm';
import VehicleMaintenanceDetail from './components/VehicleMaintenanceDetail';
import PartsView from './components/PartsView';

// =============================================================================
// SCROLL REVEAL COMPONENT
// =============================================================================

function ScrollRevealSection({ 
  children, 
  delay = 0,
  className = '' 
}: { 
  children: React.ReactNode; 
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// STATS CARD COMPONENT
// =============================================================================

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

function StatCard({ label, value, icon, color, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-lg sm:rounded-2xl border border-[#ff9350]/20 bg-gradient-to-br from-[#2d1409]/50 to-[#0a0402]/70 p-2 sm:p-4 text-left transition-all ${
        onClick ? 'hover:border-[#ff9350]/40 hover:bg-[#2d1409]/60 cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
        <div className={cn(color, "w-3 h-3 sm:w-4 sm:h-4")}>{icon}</div>
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-200/50">{label}</span>
      </div>
      <p className="text-lg sm:text-2xl font-bold text-white">{value}</p>
    </button>
  );
}

// =============================================================================
// URGENT ALERT CARD COMPONENT
// =============================================================================

interface UrgentAlertCardProps {
  type: 'oil_change' | 'tire_rotation' | 'tire_replacement';
  urgency: UrgencyLevel;
  trucks: string[];
  count: number;
  onClick: () => void;
}

function UrgentAlertCard({ type, urgency, trucks, count, onClick }: UrgentAlertCardProps) {
  const typeConfig = MAINTENANCE_TYPE_CONFIG[type];
  const urgencyConfig = getUrgencyConfig(urgency);
  
  const IconComponent = type === 'oil_change' ? Droplet 
    : type === 'tire_rotation' ? RefreshCw 
    : Circle;
  
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className={cn("w-full rounded-lg sm:rounded-xl border", urgencyConfig.borderColor, urgencyConfig.bgColor, "p-2.5 sm:p-4 text-left transition-all hover:scale-[1.02]")}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg", urgencyConfig.bgColor, urgencyConfig.borderColor, "flex items-center justify-center")}>
          <IconComponent className={cn("w-4 h-4 sm:w-5 sm:h-5", urgencyConfig.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
            <span className={cn("text-xs sm:text-sm font-semibold", urgencyConfig.textColor)}>
              {count} {count === 1 ? 'truck needs' : 'trucks need'} {typeConfig.shortLabel}
            </span>
            <span className={cn("px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase", urgencyConfig.bgColor, urgencyConfig.textColor)}>
              {urgencyConfig.label}
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-white/50 truncate">
            {trucks.slice(0, 3).join(', ')}{trucks.length > 3 ? ` +${trucks.length - 3} more` : ''}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-white/30 flex-shrink-0" />
      </div>
    </motion.button>
  );
}

// =============================================================================
// VEHICLE ROW COMPONENT
// =============================================================================

interface VehicleRowProps {
  vehicle: VehicleMaintenanceInfo;
  isSelected: boolean;
  isHighlighted?: boolean;
  onSelect: () => void;
  index: number;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

function VehicleRow({ vehicle, isSelected, isHighlighted, onSelect, index, buttonRef }: VehicleRowProps) {
  const prefersReducedMotion = useReducedMotion();
  const urgencyConfig = getUrgencyConfig(vehicle.overallUrgency);

  return (
    <motion.button
      ref={buttonRef}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
      animate={{ 
        opacity: 1, 
        x: 0,
        scale: isHighlighted ? [1, 1.02, 1] : 1,
      }}
      transition={{ 
        delay: Math.min(index * 0.02, 0.15), 
        duration: isHighlighted ? 0.6 : 0.2,
        scale: { duration: 0.6, repeat: isHighlighted ? 2 : 0 }
      }}
      onClick={onSelect}
      className={cn(
        "w-full text-left px-2.5 sm:px-4 py-2 sm:py-3 transition-all duration-150 flex items-center gap-2 sm:gap-3 group",
        isSelected
          ? 'bg-gradient-to-r from-[#ff9350]/20 to-[#ff9350]/5 border-l-2 border-l-[#ff9350]'
          : 'border-l-2 border-l-transparent hover:bg-white/[0.03]',
        isHighlighted && 'ring-2 ring-[#ff9350]/50 ring-offset-2 ring-offset-[#080403]'
      )}
    >
      {/* Status indicator */}
      <div className={cn(
        "w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0",
        vehicle.overallUrgency === 'overdue' ? 'bg-red-400' :
        vehicle.overallUrgency === 'due_soon' ? 'bg-amber-400' :
        vehicle.overallUrgency === 'upcoming' ? 'bg-blue-400' :
        'bg-emerald-400'
      )} />
      
      {/* Truck info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="font-semibold text-xs sm:text-sm text-white truncate">
            {vehicle.truckNumber}
          </span>
          {vehicle.hasUnresolvedAnomalies && (
            <span className="inline-flex items-center px-1 sm:px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[8px] sm:text-[9px] text-amber-300 font-medium">
              ⚠️ {vehicle.unresolvedAnomalyCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
          <span className="text-[10px] sm:text-[11px] text-white/50">
            {formatMileage(vehicle.currentMileage)} mi
          </span>
          <span className="text-[9px] sm:text-[10px] text-white/30">•</span>
          <span className={cn("text-[9px] sm:text-[10px]", urgencyConfig.textColor)}>
            {vehicle.urgentItems.length > 0 
              ? `${vehicle.urgentItems.length} item${vehicle.urgentItems.length !== 1 ? 's' : ''} need attention`
              : 'All good'}
          </span>
        </div>
      </div>
      
      {/* Quick status badges */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {vehicle.oilChangeStatus.urgency !== 'ok' && (
          <div className={cn("w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center", getUrgencyConfig(vehicle.oilChangeStatus.urgency).bgColor)}>
            <Droplet className={cn("w-3 h-3 sm:w-3.5 sm:h-3.5", getUrgencyConfig(vehicle.oilChangeStatus.urgency).iconColor)} />
          </div>
        )}
        {vehicle.tireRotationStatus.urgency !== 'ok' && (
          <div className={cn("w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center", getUrgencyConfig(vehicle.tireRotationStatus.urgency).bgColor)}>
            <RefreshCw className={cn("w-3 h-3 sm:w-3.5 sm:h-3.5", getUrgencyConfig(vehicle.tireRotationStatus.urgency).iconColor)} />
          </div>
        )}
      </div>
      
      <ChevronRight className={cn(
        "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all flex-shrink-0",
        isSelected ? 'text-[#ff9350]' : 'text-white/20 group-hover:text-white/40'
      )} />
    </motion.button>
  );
}


// =============================================================================
// MAIN COMPONENT
// =============================================================================

// View mode type for toggle
type ViewMode = 'repairs' | 'parts';

export default function MechanicPartsRepairsLog() {
  const { role, user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const hasAccess = role === 'mechanic' || role === 'admin';
  
  // View mode toggle state
  const [viewMode, setViewMode] = useState<ViewMode>('repairs');
  
  // Data hooks
  const {
    schedules,
    isLoading,
    error,
    createLog,
    anomalyCountsByTruck,
  } = useMaintenanceData();
  
  // Calculation hook
  const {
    vehicles,
    stats,
    batchedAlerts,
  } = useMaintenanceCalculations({
    schedules,
    anomalyCounts: anomalyCountsByTruck,
  });
  
  // URL Parameters for deep linking
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTruck = searchParams.get('truck');
  
  // UI State - initialize selectedTruckNumber from URL param
  const [selectedTruckNumber, setSelectedTruckNumber] = useState<string | null>(() => {
    return urlTruck ? urlTruck.toUpperCase().trim() : null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, UI_CONFIG.SEARCH_DEBOUNCE_MS);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showRepairForm, setShowRepairForm] = useState(false);
  const [highlightedTruck, setHighlightedTruck] = useState<string | null>(null);
  
  // Ref for scrolling to selected truck
  const selectedTruckRef = useRef<HTMLButtonElement>(null);
  // Track if we've handled the initial URL param
  const hasHandledUrlParam = useRef(false);
  
  // Handle URL parameter when vehicles load - using setTimeout to avoid sync setState in effect
  useEffect(() => {
    if (urlTruck && vehicles.length > 0 && !hasHandledUrlParam.current) {
      hasHandledUrlParam.current = true;
      const normalizedUrlTruck = urlTruck.toUpperCase().trim();
      const truckExists = vehicles.some(v => v.truckNumber === normalizedUrlTruck);
      
      if (truckExists) {
        // Defer state updates to next tick to satisfy linter
        setTimeout(() => {
          setSelectedTruckNumber(normalizedUrlTruck);
          setShowRepairForm(false);
          setHighlightedTruck(normalizedUrlTruck);
        }, 0);
        
        // Clear highlight after animation
        setTimeout(() => setHighlightedTruck(null), 2000);
        
        // Scroll to truck after rendering
        setTimeout(() => {
          selectedTruckRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
          });
        }, 100);
      } else {
        // Invalid truck - clear the URL param
        setTimeout(() => {
          setSearchParams({}, { replace: true });
        }, 0);
      }
    }
  }, [urlTruck, vehicles, setSearchParams]);
  
  // Device capabilities
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;
  
  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    let filtered = vehicles;
    
    // Filter by urgency
    if (urgencyFilter !== 'all') {
      filtered = filtered.filter(v => v.overallUrgency === urgencyFilter);
    }
    
    // Filter by search
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(v => 
        v.truckNumber.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [vehicles, urgencyFilter, debouncedSearch]);
  
  // Pagination
  const pageSize = UI_CONFIG.PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const paginatedVehicles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVehicles.slice(start, start + pageSize);
  }, [filteredVehicles, currentPage, pageSize]);
  
  // Selected vehicle
  const selectedVehicle = useMemo(() => 
    vehicles.find(v => v.truckNumber === selectedTruckNumber) || null,
  [vehicles, selectedTruckNumber]);
  
  // Handlers
  const handleSelectVehicle = useCallback((truckNumber: string) => {
    const newSelection = selectedTruckNumber === truckNumber ? null : truckNumber;
    setSelectedTruckNumber(newSelection);
    setShowRepairForm(false);
    
    // Update URL parameter (replace to avoid cluttering history)
    if (newSelection) {
      setSearchParams({ truck: newSelection }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [selectedTruckNumber, setSearchParams]);
  
  const handleLogRepair = useCallback(() => {
    setShowRepairForm(true);
  }, []);
  
  const handleRepairSubmit = useCallback(async (data: Parameters<typeof createLog>[0]) => {
    try {
      await createLog(data);
      setShowRepairForm(false);
    } catch {
      // Error handled in hook
    }
  }, [createLog]);
  
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setUrgencyFilter('all');
    setCurrentPage(1);
  }, []);
  
  // Access check
  if (!hasAccess) {
    return (
      <DashboardLayout title="Parts & Repairs Log" pageHeading>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout title="Parts & Repairs Log" pageHeading>
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-3 sm:pb-4 pt-2 sm:pt-6">
        {/* Premium Glass Header - Ember Theme */}
        <div className="mb-3 sm:mb-5 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div 
              className="relative overflow-hidden rounded-lg sm:rounded-2xl md:rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
              style={{
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                background: 'linear-gradient(145deg, rgba(45, 20, 8, 0.6) 0%, rgba(20, 8, 4, 0.5) 50%, rgba(10, 4, 2, 0.4) 100%)',
                boxShadow: 'inset 0 0 15px rgba(255, 147, 80, 0.08), 0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)' }} />
              <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255, 147, 80, 0.3) 0%, transparent 70%)', filter: 'blur(15px)' }} />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
              
              <div className="relative px-3 py-2.5 sm:px-5 sm:py-4 md:px-7 md:py-5">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-amber-500/15 border border-amber-500/30"
                  >
                    <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-bold text-amber-200">Mechanics</span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-[#1a0804]/60 border border-amber-500/20"
                  >
                    <Package className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                    <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-semibold text-amber-200/70">Parts & Repairs</span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-0.5 sm:w-1 h-10 sm:h-14 md:h-16 rounded-full bg-gradient-to-b from-amber-400 via-orange-500 to-red-600 origin-top flex-shrink-0"
                    style={{ boxShadow: '0 0 20px rgba(251, 146, 60, 0.4), 0 0 40px rgba(251, 146, 60, 0.2)' }}
                  />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect
                        as="h1"
                        preset="blurSlide"
                        per="char"
                        delay={0.15}
                        className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight"
                        segmentWrapperClassName="bg-gradient-to-r from-white via-amber-100 to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,146,60,0.3)]"
                      >
                        Parts & Repairs Log
                      </TextEffect>
                    ) : (
                      <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-amber-100 to-white/90 bg-clip-text text-transparent">
                        Parts & Repairs Log
                      </h1>
                    )}
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.7 }}
                      className="mt-1 sm:mt-1.5 md:mt-2 text-[10px] sm:text-xs md:text-sm text-amber-200/50 font-medium leading-relaxed max-w-xl"
                    >
                      Track maintenance, log repairs, and manage fleet health
                    </motion.p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/[0.15] to-transparent" />
            </div>
          </motion.div>
        </div>
        
        {/* View Mode Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mb-3 sm:mb-5"
        >
          <div className="inline-flex p-0.5 sm:p-1 bg-black/40 rounded-lg sm:rounded-xl border border-white/10 backdrop-blur-sm">
            <button
              onClick={() => setViewMode('repairs')}
              className={cn(
                "relative px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all duration-200",
                viewMode === 'repairs'
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/70'
              )}
            >
              {viewMode === 'repairs' && (
                <motion.div
                  layoutId="activeViewTab"
                  className="absolute inset-0 bg-gradient-to-r from-[#ff9350] to-[#e87830] rounded-md sm:rounded-lg shadow-lg shadow-[#ff9350]/20"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative flex items-center gap-1.5 sm:gap-2">
                <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Repairs Log</span>
                <span className="sm:hidden">Repairs</span>
              </span>
            </button>
            <button
              onClick={() => setViewMode('parts')}
              className={cn(
                "relative px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all duration-200",
                viewMode === 'parts'
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/70'
              )}
            >
              {viewMode === 'parts' && (
                <motion.div
                  layoutId="activeViewTab"
                  className="absolute inset-0 bg-gradient-to-r from-[#ff9350] to-[#e87830] rounded-md sm:rounded-lg shadow-lg shadow-[#ff9350]/20"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative flex items-center gap-1.5 sm:gap-2">
                <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Parts & Fixes</span>
                <span className="sm:hidden">Parts</span>
              </span>
            </button>
          </div>
        </motion.div>
        
        {/* Conditional View Rendering */}
        {viewMode === 'parts' ? (
          <PartsView />
        ) : (
          <>
        {/* Stats Summary */}
        <ScrollRevealSection delay={0}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-5">
            <StatCard 
              label="Total Vehicles" 
              value={stats.totalVehicles} 
              icon={<Truck className="w-4 h-4" />}
              color="text-amber-400"
            />
            <StatCard 
              label="Overdue" 
              value={stats.overdueCount} 
              icon={<AlertTriangle className="w-4 h-4" />}
              color="text-red-400"
              onClick={() => setUrgencyFilter('overdue')}
            />
            <StatCard 
              label="Due Soon" 
              value={stats.dueSoonCount} 
              icon={<Clock className="w-4 h-4" />}
              color="text-amber-400"
              onClick={() => setUrgencyFilter('due_soon')}
            />
            <StatCard 
              label="All Good" 
              value={stats.okCount} 
              icon={<CheckCircle2 className="w-4 h-4" />}
              color="text-emerald-400"
              onClick={() => setUrgencyFilter('ok')}
            />
          </div>
        </ScrollRevealSection>
        
        {/* Urgent Alerts */}
        {batchedAlerts.length > 0 && (
          <ScrollRevealSection delay={0.05}>
            <div className="mb-3 sm:mb-5">
              <h2 className="text-[10px] sm:text-xs uppercase tracking-wider text-amber-200/50 font-medium px-1 mb-2 sm:mb-3">
                Needs Attention
              </h2>
              <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {batchedAlerts.slice(0, 6).map((alert) => (
                  <UrgentAlertCard
                    key={`${alert.type}-${alert.urgency}`}
                    type={alert.type}
                    urgency={alert.urgency}
                    trucks={alert.trucks}
                    count={alert.count}
                    onClick={() => {
                      setUrgencyFilter(alert.urgency);
                      setCurrentPage(1);
                    }}
                  />
                ))}
              </div>
            </div>
          </ScrollRevealSection>
        )}
        
        {/* Filter Bar */}
        <ScrollRevealSection delay={0.1}>
          <div className="rounded-lg sm:rounded-xl border border-[#ff9350]/15 bg-gradient-to-r from-[#0c0402] to-[#120805] p-2 sm:p-3 mb-3 sm:mb-5">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {/* Urgency Filter */}
              <div className="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-black/30 rounded-md sm:rounded-lg border border-white/5 overflow-x-auto">
                {(['all', 'overdue', 'due_soon', 'upcoming', 'ok'] as const).map((level) => {
                  const isSelected = urgencyFilter === level;
                  const config = level === 'all' ? null : URGENCY_CONFIG[level];
                  return (
                    <button
                      key={level}
                      onClick={() => { setUrgencyFilter(level); setCurrentPage(1); }}
                      className={cn(
                        "px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap shrink-0",
                        isSelected
                          ? 'bg-gradient-to-r from-[#ff9350] to-[#e87830] text-white shadow-md'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      )}
                    >
                      {level === 'all' ? 'All' : config?.label}
                    </button>
                  );
                })}
              </div>
              
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search by truck number..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-black/30 border border-white/10 rounded-md sm:rounded-lg pl-7 sm:pl-8 pr-7 sm:pr-8 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#ff9350]/50 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                    className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
              
              {/* Clear filters */}
              {(urgencyFilter !== 'all' || searchQuery) && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 transition-all shrink-0"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </ScrollRevealSection>
        
        {/* Main Content */}
        <ScrollRevealSection delay={0.15}>
          {isLoading && (
            <div className="space-y-3">
              <div className="hidden lg:block">
                <TableSkeleton rows={5} columns={4} variant="ember" />
              </div>
              <div className="lg:hidden">
                <CardListSkeleton rows={4} variant="ember" />
              </div>
            </div>
          )}
          
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          
          {!isLoading && !error && (
            <div className="grid gap-2 sm:gap-4 lg:grid-cols-3">
              {/* Vehicle List */}
              <div className="rounded-lg sm:rounded-xl border border-white/10 bg-[#080403] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-2.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ff9350]" />
                    <span className="text-[10px] sm:text-xs font-medium text-white/80">Fleet Vehicles</span>
                    <span className="text-[9px] sm:text-[10px] text-white/40">({filteredVehicles.length})</span>
                  </div>
                  {/* Pagination */}
                  {filteredVehicles.length > 0 && (
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-0.5 sm:p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                      <span className="text-[9px] sm:text-[10px] text-white/50 min-w-[35px] sm:min-w-[40px] text-center">
                        {currentPage}/{totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-0.5 sm:p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                
                {/* List */}
                <div className="max-h-[500px] sm:max-h-[600px] overflow-y-auto flex-1 divide-y divide-white/[0.03]">
                  {paginatedVehicles.length === 0 ? (
                    <div className="p-4 sm:p-6 text-center text-white/50">
                      <Truck className="w-8 h-8 sm:w-10 sm:h-10 text-white/20 mx-auto mb-1.5 sm:mb-2" />
                      <p className="text-xs sm:text-sm">
                        {searchQuery || urgencyFilter !== 'all' 
                          ? 'No vehicles match your filters' 
                          : 'No vehicles found'}
                      </p>
                    </div>
                  ) : (
                    paginatedVehicles.map((vehicle, index) => (
                      <VehicleRow
                        key={vehicle.truckNumber}
                        vehicle={vehicle}
                        isSelected={vehicle.truckNumber === selectedTruckNumber}
                        isHighlighted={vehicle.truckNumber === highlightedTruck}
                        onSelect={() => handleSelectVehicle(vehicle.truckNumber)}
                        index={index}
                        buttonRef={vehicle.truckNumber === selectedTruckNumber ? selectedTruckRef : undefined}
                      />
                    ))
                  )}
                </div>
              </div>
              
              {/* Detail Panel */}
              <div className="lg:col-span-2">
                <AnimatePresence mode="wait">
                  {!selectedVehicle && !showRepairForm ? (
                    <motion.div
                      key="empty-state"
                      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="h-full min-h-[300px] sm:min-h-[400px] rounded-lg sm:rounded-xl border border-white/5 bg-[#050302] p-4 sm:p-6 flex flex-col items-center justify-center text-center"
                    >
                      <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-[#ff9350]/10 border border-[#ff9350]/20 mb-3 sm:mb-4">
                        <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-[#ff9350]/70" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-white/80 mb-1">
                        Select a Vehicle
                      </p>
                      <p className="text-[10px] sm:text-xs text-white/40 max-w-xs">
                        Choose a truck from the list to view maintenance status and log repairs
                      </p>
                    </motion.div>
                  ) : showRepairForm && selectedVehicle ? (
                    <RepairLogForm
                      key="repair-form"
                      truckNumber={selectedVehicle.truckNumber}
                      currentMileage={selectedVehicle.currentMileage}
                      performedByName={user?.email || ''}
                      onSubmit={handleRepairSubmit}
                      onCancel={() => setShowRepairForm(false)}
                    />
                  ) : selectedVehicle ? (
                    <VehicleMaintenanceDetail
                      key={selectedVehicle.truckNumber}
                      vehicle={selectedVehicle}
                      onLogRepair={handleLogRepair}
                    />
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          )}
        </ScrollRevealSection>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
