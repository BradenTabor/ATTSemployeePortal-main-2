export type AttendanceStatus = 'present' | 'absent' | 'ncns' | 'rto';

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  status: AttendanceStatus;
  marked_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithAttendance {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
  status: AttendanceStatus | null;
  attendance_id: string | null;
}

export interface MarkAttendancePayload {
  userId: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface BulkMarkPayload {
  userIds: string[];
  date: string;
  status: AttendanceStatus;
}

export interface WeeklyStats {
  present: number;
  absent: number;
  ncns: number;
  rto: number;
  total: number;
  percentage: number;
}

export const STATUS_CONFIG = {
  present: {
    label: 'Present',
    shortLabel: 'In',
    color: 'emerald',
    bgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    solidClass: 'bg-emerald-500 text-white',
    dotClass: 'bg-emerald-400',
    icon: 'CheckCircle' as const,
  },
  absent: {
    label: 'Absent',
    shortLabel: 'Out',
    color: 'red',
    bgClass: 'bg-red-500/20 text-red-300 border-red-500/30',
    solidClass: 'bg-red-500 text-white',
    dotClass: 'bg-red-400',
    icon: 'XCircle' as const,
  },
  ncns: {
    label: 'NCNS',
    shortLabel: 'NC',
    color: 'amber',
    bgClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    solidClass: 'bg-amber-500 text-white',
    dotClass: 'bg-amber-400',
    icon: 'AlertTriangle' as const,
  },
  rto: {
    label: 'RTO',
    shortLabel: 'RTO',
    color: 'blue',
    bgClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    solidClass: 'bg-blue-500 text-white',
    dotClass: 'bg-blue-400',
    icon: 'Calendar' as const,
  },
} as const;

export const ALL_STATUSES: AttendanceStatus[] = ['present', 'absent', 'ncns', 'rto'];

// ---------------------------------------------------------------------------
// Attendance Summary (date-range view)
// ---------------------------------------------------------------------------

export interface AttendanceSummaryRow {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
  days_present: number;
  days_absent: number;
  days_ncns: number;
  days_rto: number;
  total_days: number;
  attendance_rate: number; // 0–100
}

export interface AttendanceSummaryAggregates {
  totalPresent: number;
  totalAbsent: number;
  totalNcns: number;
  totalRto: number;
  totalRecords: number;
  overallRate: number;
}

export interface AiSummaryState {
  status: 'idle' | 'loading' | 'success' | 'error';
  summary: string | null;
  generatedAt: string | null;
  cached: boolean;
  error: string | null;
  retryable: boolean;
}
