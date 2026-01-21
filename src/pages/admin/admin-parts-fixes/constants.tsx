/**
 * Constants for AdminPartsFixesOverview page
 */

import { Wrench, ClipboardCheck, Cog } from 'lucide-react';
import type { FixSource, AssetType } from '../../mechanic/types/maintenance.types';

// =============================================================================
// SOURCE CONFIGURATION
// =============================================================================

export const SOURCE_CONFIG: Record<FixSource, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  repairs_log: { 
    label: 'Repair Log', 
    color: 'text-amber-300', 
    bgColor: 'bg-amber-500/20 border-amber-500/30',
    icon: <Wrench className="w-3.5 h-3.5" /> 
  },
  dvir: { 
    label: 'DVIR', 
    color: 'text-blue-300', 
    bgColor: 'bg-blue-500/20 border-blue-500/30',
    icon: <ClipboardCheck className="w-3.5 h-3.5" /> 
  },
  equipment: { 
    label: 'Equipment', 
    color: 'text-purple-300', 
    bgColor: 'bg-purple-500/20 border-purple-500/30',
    icon: <Cog className="w-3.5 h-3.5" /> 
  },
};

// =============================================================================
// ASSET TYPE CONFIGURATION
// =============================================================================

export const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; color: string }> = {
  truck: { label: 'Truck', color: 'text-amber-400' },
  chipper: { label: 'Chipper', color: 'text-emerald-400' },
  trailer: { label: 'Trailer', color: 'text-blue-400' },
  equipment: { label: 'Equipment', color: 'text-purple-400' },
};
