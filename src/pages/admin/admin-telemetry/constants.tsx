/**
 * Constants for AdminTelemetry page
 */

import {
  FileText,
  CheckCircle2,
  XCircle,
  Truck,
  Wrench,
  Calendar,
  ClipboardCheck,
  Eye,
  AlertTriangle,
  Shield,
  Zap,
} from "lucide-react";

// =============================================================================
// DATE RANGE OPTIONS
// =============================================================================

export const DATE_RANGE_OPTIONS = [
  { label: "7 Days", days: 7 },
  { label: "14 Days", days: 14 },
  { label: "30 Days", days: 30 },
  { label: "90 Days", days: 90 },
];

// =============================================================================
// FORM TYPE CONFIGURATION
// =============================================================================

export const FORM_TYPE_LABELS: Record<string, string> = {
  dvir: "DVIR",
  equipment: "Equipment",
  rto: "Time Off",
  jsa: "JSA",
};

export const FORM_TYPE_META: Record<string, { 
  label: string; 
  fullName: string;
  icon: React.ReactNode; 
  color: string;
  description: string;
}> = {
  dvir: { 
    label: "DVIR", 
    fullName: "Driver Vehicle Inspection Report",
    icon: <Truck className="w-5 h-5" />, 
    color: "emerald",
    description: "Pre/post-trip vehicle safety checks"
  },
  equipment: { 
    label: "Equipment", 
    fullName: "Daily Equipment Inspection",
    icon: <Wrench className="w-5 h-5" />, 
    color: "blue",
    description: "Equipment condition assessments"
  },
  rto: { 
    label: "Time Off", 
    fullName: "Request Time Off",
    icon: <Calendar className="w-5 h-5" />, 
    color: "purple",
    description: "PTO and leave requests"
  },
  jsa: { 
    label: "JSA", 
    fullName: "Job Safety Analysis",
    icon: <ClipboardCheck className="w-5 h-5" />, 
    color: "amber",
    description: "Hazard identification & mitigation"
  },
};

// =============================================================================
// EVENT TYPE CONFIGURATION
// =============================================================================

export const EVENT_TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  form_started: { label: "Form Started", color: "blue", icon: <FileText className="w-3.5 h-3.5" /> },
  form_submitted: { label: "Form Submitted", color: "emerald", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  form_submit_error: { label: "Form Error", color: "red", icon: <XCircle className="w-3.5 h-3.5" /> },
  announcement_viewed: { label: "Announcement Viewed", color: "purple", icon: <Eye className="w-3.5 h-3.5" /> },
  form_duplicate_detected: { label: "Duplicate Detected", color: "amber", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  form_duplicate_prevented: { label: "Duplicate Prevented", color: "emerald", icon: <Shield className="w-3.5 h-3.5" /> },
  form_duplicate_overridden: { label: "Duplicate Overridden", color: "amber", icon: <Zap className="w-3.5 h-3.5" /> },
};

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

// =============================================================================
// COLOR CLASSES
// =============================================================================

export const STAT_BOX_COLORS = {
  emerald: "border-emerald-500/30 bg-emerald-500/5",
  blue: "border-blue-500/30 bg-blue-500/5",
  amber: "border-amber-500/30 bg-amber-500/5",
  red: "border-red-500/30 bg-red-500/5",
  purple: "border-purple-500/30 bg-purple-500/5",
};

export const STAT_TEXT_COLORS = {
  emerald: "text-emerald-400",
  blue: "text-blue-400",
  amber: "text-amber-400",
  red: "text-red-400",
  purple: "text-purple-400",
};

export const CHIP_COLORS = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  red: "border-red-500/30 bg-red-500/10 text-red-400",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};
