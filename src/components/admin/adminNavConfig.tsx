import {
  CalendarCheck,
  ClipboardList,
  Users,
  Wrench,
  Gauge,
  Briefcase,
  TrendingUp,
  HardHat,
  Shield,
  FileText,
  Megaphone,
  FileSearch,
  Phone,
  History,
} from "lucide-react";
import type { AdminNavCardConfig } from "./AdminPremiumScaffold";

// Card variant type for the factory function
type CardVariant = "emerald" | "gold" | "ember" | "purple" | "redwhite" | "bluewhite";

// Icon color mappings for each variant
const ICON_COLORS: Record<CardVariant, string> = {
  emerald: "text-emerald-300",
  gold: "text-[#f4c979]",
  ember: "text-[#ffb887]",
  purple: "text-[#c084fc]",
  redwhite: "text-[#fecaca]",
  bluewhite: "text-[#bfdbfe]",
};

/**
 * Factory function to generate common nav cards with a specific theme variant.
 * These are the standard navigation cards shared across all role dashboards.
 */
export function getCommonNavCards(variant: CardVariant): AdminNavCardConfig[] {
  const iconClass = `w-8 h-8 ${ICON_COLORS[variant]}`;
  
  return [
    {
      title: "My Jobs",
      description: "View and track your assigned work",
      icon: <Briefcase className={iconClass} />,
      to: "/assigned-jobs",
      variant,
    },
    {
      title: "Company Forms",
      description: "Access and submit required forms",
      icon: <FileText className={iconClass} />,
      to: "/forms",
      variant,
    },
    {
      title: "Announcements",
      description: "Latest company news and updates",
      icon: <Megaphone className={iconClass} />,
      to: "/announcements",
      variant,
    },
    {
      title: "Resources",
      description: "Training materials and documents",
      icon: <FileSearch className={iconClass} />,
      to: "/resources",
      variant,
    },
    {
      title: "Contact",
      description: "Reach out to management and HR",
      icon: <Phone className={iconClass} />,
      to: "/contact",
      variant,
    },
    {
      title: "Forms History",
      description: "View your past form submissions",
      icon: <History className={iconClass} />,
      to: "/forms-history",
      variant,
    },
  ];
}

export const ADMIN_CORE_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "RTO Requests",
    description: "View and manage employee time-off submissions.",
    icon: <CalendarCheck className="w-8 h-8 text-[#f4c979]" />,
    to: "/admin/rto",
    variant: "gold",
  },
  {
    title: "User Management",
    description: "Manage user accounts and permissions.",
    icon: <Users className="w-8 h-8 text-[#f4c979]" />,
    to: "/admin/users",
    variant: "gold",
  },
  {
    title: "Daily JSA Oversight",
    description: "Audit every job safety analysis in one place.",
    icon: <ClipboardList className="w-8 h-8 text-[#f4c979]" />,
    to: "/admin/jsa",
    variant: "gold",
  },
  {
    title: "Job Progress Tracker",
    description: "Create and monitor job timelines with crew assignments.",
    icon: <Briefcase className="w-8 h-8 text-[#f4c979]" />,
    to: "/admin/jobs",
    variant: "gold",
  },
  {
    title: "Job Progress Analytics",
    description: "Span-based production and week-over-week deltas.",
    icon: <TrendingUp className="w-8 h-8 text-[#f4c979]" />,
    to: "/admin/job-progress",
    variant: "gold",
  },
];

export const MECHANIC_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "Fleet & Equipment Center",
    description: "Review DVIRs and equipment inspections, log repairs.",
    icon: <Wrench className="w-8 h-8 text-[#ffb887]" />,
    to: "/mechanic/equipment-logs",
    variant: "ember",
  },
  {
    title: "Preventive Maintenance",
    description: "Schedule PM windows and automate reminders.",
    icon: <Gauge className="w-8 h-8 text-[#ff9c63]" />,
    to: "/mechanic-dashboard#pm",
    variant: "ember",
    comingSoon: true,
  },
  {
    title: "Parts & Repairs Log",
    description: "Track usage, repeat issues, and inventory.",
    icon: <Wrench className="w-8 h-8 text-[#ff8a4b]" />,
    to: "/mechanic-dashboard#repairs",
    variant: "ember",
    comingSoon: true,
  },
];

export const GENERAL_FOREMAN_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "Crew Oversight",
    description: "Monitor all crew assignments and progress.",
    icon: <Users className="w-8 h-8 text-[#c084fc]" />,
    to: "/crew-oversight",
    variant: "purple",
  },
  {
    title: "Safety Compliance",
    description: "Review JSA submissions and safety reports.",
    icon: <ClipboardList className="w-8 h-8 text-[#c084fc]" />,
    to: "/general-foreman/safety-compliance",
    variant: "purple",
  },
  {
    title: "Equipment Logs",
    description: "View equipment inspections and DVIR status.",
    icon: <HardHat className="w-8 h-8 text-[#c084fc]" />,
    to: "/general-foreman/equipment-logs",
    variant: "purple",
  },
];

export const SAFETY_OFFICER_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "Incident Reports",
    description: "Track and investigate safety incidents.",
    icon: <Shield className="w-8 h-8 text-[#fecaca]" />,
    to: "/safety-officer-dashboard#incidents",
    variant: "redwhite",
    comingSoon: true,
  },
  {
    title: "JSA Audits",
    description: "Review and approve job safety analyses.",
    icon: <ClipboardList className="w-8 h-8 text-[#fecaca]" />,
    to: "/safety-officer-dashboard#jsa",
    variant: "redwhite",
    comingSoon: true,
  },
  {
    title: "Training Records",
    description: "Manage safety certifications and training.",
    icon: <Users className="w-8 h-8 text-[#fecaca]" />,
    to: "/safety-officer-dashboard#training",
    variant: "redwhite",
    comingSoon: true,
  },
];

export const FOREMAN_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "My Crew",
    description: "Manage your assigned crew members.",
    icon: <Users className="w-8 h-8 text-[#bfdbfe]" />,
    to: "/foreman-dashboard#crew",
    variant: "bluewhite",
    comingSoon: true,
  },
  {
    title: "Daily Reports",
    description: "Submit and view job progress reports.",
    icon: <ClipboardList className="w-8 h-8 text-[#bfdbfe]" />,
    to: "/foreman/daily-reports",
    variant: "bluewhite",
    comingSoon: true,
  },
];

