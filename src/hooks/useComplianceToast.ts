/**
 * useComplianceToast - Orchestrates compliance celebration notifications
 * 
 * This hook manages the display of premium animated toasts after form submissions:
 * 
 * 1. After single form submission → Shows success with nudge for remaining forms
 * 2. After all 3 forms complete → Triggers full-page celebration
 * 
 * Usage:
 * ```typescript
 * const { checkAndCelebrate, FullCelebration, celebrationProps } = useComplianceToast();
 * 
 * // After form submission success
 * await checkAndCelebrate('dvir');
 * 
 * // Render the celebration component
 * <FullCelebration {...celebrationProps} />
 * ```
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useInvalidateCompliance } from './queries/useComplianceQuery';
import { FullComplianceCelebration } from '../components/compliance/FullComplianceCelebration';

// Form type definitions
export type ComplianceFormType = 'dvir' | 'equipment' | 'jsa';

export interface ComplianceStatus {
  dvir: boolean;
  equipment: boolean;
  jsa: boolean;
}

export interface RemainingForm {
  type: ComplianceFormType;
  label: string;
  shortLabel: string;
  path: string;
}

// Form metadata
const FORM_INFO: Record<ComplianceFormType, { label: string; shortLabel: string; path: string }> = {
  dvir: {
    label: 'Daily Vehicle Inspection',
    shortLabel: 'DVIR',
    path: '/dashboard/forms/dvir',
  },
  equipment: {
    label: 'Equipment Inspection',
    shortLabel: 'Equipment',
    path: '/dashboard/forms/equipment-inspection',
  },
  jsa: {
    label: 'Job Safety Analysis',
    shortLabel: 'JSA',
    path: '/forms/jsa',
  },
};

// Helper to get today's date in Chicago timezone
function getTodayDateString(): string {
  const now = new Date();
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const year = chicagoDate.getFullYear();
  const month = String(chicagoDate.getMonth() + 1).padStart(2, '0');
  const day = String(chicagoDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface UseComplianceToastReturn {
  /** Check compliance status and trigger appropriate celebration */
  checkAndCelebrate: (justSubmitted: ComplianceFormType) => Promise<{
    allComplete: boolean;
    remaining: RemainingForm[];
    status: ComplianceStatus;
  }>;
  /** Whether full celebration is currently showing */
  showFullCelebration: boolean;
  /** Props for the full celebration component */
  celebrationProps: {
    isVisible: boolean;
    userName: string;
    onDismiss: () => void;
  };
  /** The FullComplianceCelebration component for rendering */
  FullCelebration: typeof FullComplianceCelebration;
  /** Dismiss the full celebration manually */
  dismissCelebration: () => void;
  /** Get remaining forms based on current status */
  getRemainingForms: (status: ComplianceStatus, exclude?: ComplianceFormType) => RemainingForm[];
}

export function useComplianceToast(): UseComplianceToastReturn {
  const { user, fullName } = useAuth();
  // Note: useNavigate is available if navigation is needed in future
  useNavigate();
  const invalidateCompliance = useInvalidateCompliance();
  
  const [showFullCelebration, setShowFullCelebration] = useState(false);

  // Get user's display name
  const userName = useMemo(() => {
    return fullName || user?.email?.split('@')[0] || 'Team Member';
  }, [fullName, user?.email]);

  // Calculate remaining forms
  const getRemainingForms = useCallback((status: ComplianceStatus, exclude?: ComplianceFormType): RemainingForm[] => {
    const remaining: RemainingForm[] = [];
    
    const formTypes: ComplianceFormType[] = ['dvir', 'equipment', 'jsa'];
    for (const type of formTypes) {
      if (!status[type] && type !== exclude) {
        remaining.push({
          type,
          ...FORM_INFO[type],
        });
      }
    }
    
    return remaining;
  }, []);

  // Extract userId to satisfy React Compiler memoization requirements
  const userId = user?.id;

  // Fetch fresh compliance status from database
  const fetchComplianceStatus = useCallback(async (): Promise<ComplianceStatus> => {
    if (!userId) {
      return { dvir: false, equipment: false, jsa: false };
    }

    const todayDate = getTodayDateString();
    const today = new Date(todayDate);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().slice(0, 10);

    const [dvirResult, equipmentResult, jsaResult] = await Promise.all([
      // DVIR uses created_at (no report_date column exists in schema)
      supabase
        .from('dvir_reports')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${todayDate}T00:00:00`)
        .lt('created_at', `${tomorrowDate}T00:00:00`)
        .limit(1),
      // Equipment uses inspection_date
      supabase
        .from('daily_equipment_inspections')
        .select('id')
        .eq('user_id', userId)
        .eq('inspection_date', todayDate)
        .limit(1),
      // JSA uses created_at
      supabase
        .from('daily_jsa')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${todayDate}T00:00:00`)
        .lt('created_at', `${tomorrowDate}T00:00:00`)
        .limit(1),
    ]);

    return {
      dvir: (dvirResult.data?.length ?? 0) > 0,
      equipment: (equipmentResult.data?.length ?? 0) > 0,
      jsa: (jsaResult.data?.length ?? 0) > 0,
    };
  }, [userId]);

  // Main function to check compliance and trigger celebration
  const checkAndCelebrate = useCallback(async (justSubmitted: ComplianceFormType) => {
    // Invalidate cache to ensure fresh data on dashboard
    invalidateCompliance();
    
    // Give DB a moment to commit, then fetch fresh status
    await new Promise(resolve => setTimeout(resolve, 300));
    const status = await fetchComplianceStatus();
    
    // Mark the just-submitted form as complete (in case DB hasn't fully propagated)
    status[justSubmitted] = true;
    
    const remaining = getRemainingForms(status);
    const allComplete = remaining.length === 0;

    if (allComplete) {
      // Show full celebration!
      setShowFullCelebration(true);
    }

    return {
      allComplete,
      remaining,
      status,
    };
  }, [fetchComplianceStatus, getRemainingForms, invalidateCompliance]);

  // Dismiss celebration
  const dismissCelebration = useCallback(() => {
    setShowFullCelebration(false);
  }, []);

  // Props for the celebration component
  const celebrationProps = useMemo(() => ({
    isVisible: showFullCelebration,
    userName,
    onDismiss: dismissCelebration,
  }), [showFullCelebration, userName, dismissCelebration]);

  return {
    checkAndCelebrate,
    showFullCelebration,
    celebrationProps,
    FullCelebration: FullComplianceCelebration,
    dismissCelebration,
    getRemainingForms,
  };
}

export default useComplianceToast;
