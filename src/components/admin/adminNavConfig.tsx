import {
  ClipboardList,
  FileText,
  Users,
  Wrench,
  Gauge,
  Shield,
} from "lucide-react";
import type { AdminNavCardConfig } from "./AdminPremiumScaffold";

// Card variant type for the factory function
type CardVariant = "emerald" | "gold" | "ember" | "purple" | "redwhite" | "bluewhite";

/**
 * Factory function to generate common nav cards with a specific theme variant.
 * These are the standard navigation cards shared across all role dashboards.
 */
export function getCommonNavCards(variant: CardVariant): AdminNavCardConfig[] {
  return [
    {
      title: "My Jobs",
      description: "View and track your assigned work",
      icon: <img loading="lazy" src="/assets/my-jobs.webp" alt="" className="w-full h-full object-contain" />,
      to: "/assigned-jobs",
      variant,
      iconAsImage: true,
    },
    {
      title: "Company Forms",
      description: "Access and submit required forms",
      icon: <img loading="lazy" src="/assets/company-forms.webp" alt="" className="w-full h-full object-contain" />,
      to: "/forms",
      variant,
      iconAsImage: true,
    },
    {
      title: "Announcements",
      description: "Latest company news and updates",
      icon: <img loading="lazy" src="/assets/announcements.webp" alt="" className="w-full h-full object-contain" />,
      to: "/announcements",
      variant,
      iconAsImage: true,
    },
    {
      title: "Resources",
      description: "Training materials and documents",
      icon: <img loading="lazy" src="/assets/resources.webp" alt="" className="w-full h-full object-contain" />,
      to: "/resources",
      variant,
      iconAsImage: true,
    },
    {
      title: "Contact",
      description: "Reach out to management and HR",
      icon: <img loading="lazy" src="/assets/contact.webp" alt="" className="w-full h-full object-contain" />,
      to: "/contact",
      variant,
      iconAsImage: true,
    },
    {
      title: "Team Contacts",
      description: "Call or email any teammate directly",
      icon: <img loading="lazy" src="/assets/contact.webp" alt="" className="w-full h-full object-contain" />,
      to: "/team-contacts",
      variant,
      iconAsImage: true,
    },
    {
      title: "Forms History",
      description: "View your past form submissions",
      icon: <img loading="lazy" src="/assets/forms-history.webp" alt="" className="w-full h-full object-contain" />,
      to: "/forms-history",
      variant,
      iconAsImage: true,
    },
    {
      title: "Emergency Action Plan",
      description: "911, contacts, evacuation, OSHA reporting",
      icon: <img loading="lazy" src="/assets/emergency-action-plan.webp" alt="" className="w-full h-full object-contain" />,
      to: "/emergency-action-plan",
      variant,
      iconAsImage: true,
    },
    {
      title: "Safety Rewards",
      description: "Monthly raffle entries and prizes",
      icon: <img loading="lazy" src="/assets/safety-rewards.webp" alt="" className="w-full h-full object-contain" />,
      to: "/safety-rewards",
      variant,
      iconAsImage: true,
    },
  ];
}

export const ADMIN_CORE_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "Requests & Oversight",
    description: "RTO, JSA oversight, and parts & fixes in one place.",
    icon: <img loading="lazy" src="/assets/rto-requests.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/requests-oversight",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Users & Activity",
    description: "Manage accounts and view live engagement.",
    icon: <img loading="lazy" src="/assets/user-management.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/users",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Email Recipients",
    description: "Manage compliance and safety forecast email lists.",
    icon: <img loading="lazy" src="/assets/email-recipients.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/email-recipients",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Safety Settings",
    description: "Configure announcements, briefings, and reward points.",
    icon: <img loading="lazy" src="/assets/control-panel.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/safety-settings",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Mass SMS",
    description: "Send one SMS to all app users with a phone number.",
    icon: <img loading="lazy" src="/assets/email-recipients.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/mass-sms",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Operations Hub",
    description: "Manage work sites, crews, and job assignments.",
    icon: <img loading="lazy" src="/assets/operations-hub.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/operations",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Job Progress Analytics",
    description: "Span-based production and week-over-week deltas.",
    icon: <img loading="lazy" src="/assets/job-progress-analytics.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/job-progress",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Safety & Compliance",
    description: "Analytics · Risk Calibration · Compliance Audit",
    icon: <img loading="lazy" src="/assets/safety-analytics.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/safety-compliance",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Telemetry Dashboard",
    description: "Form analytics, engagement metrics, and system health.",
    icon: <img loading="lazy" src="/assets/telemetry-dashboard.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/telemetry",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Certifications & Qualifications",
    description: "Track certifications, grade tests, manage access, and OSHA 1910.269 electrical levels.",
    icon: <img loading="lazy" src="/assets/certifications.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/certifications",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Emergency Action Plan",
    description: "Site emergency contacts, triage, evacuation, OSHA reporting.",
    icon: <img loading="lazy" src="/assets/emergency-action-plan.webp" alt="" className="w-full h-full object-contain" />,
    to: "/emergency-action-plan",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Safety Rewards",
    description: "Manage monthly raffle prizes and run drawings.",
    icon: <img loading="lazy" src="/assets/safety-rewards.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/safety-rewards",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Manual Point Awards",
    description: "Grant awarders, audit manual awards, and review caps.",
    icon: <img loading="lazy" src="/assets/safety-rewards.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/manual-awards",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Redemption Fulfillment",
    description: "Fulfill or deny employee reward store requests.",
    icon: <img loading="lazy" src="/assets/safety-rewards.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/redemption-fulfillment",
    variant: "gold",
    iconAsImage: true,
  },
  {
    title: "Reward Catalog",
    description: "Create and manage redemption store items, prices, and images.",
    icon: <img loading="lazy" src="/assets/safety-rewards.webp" alt="" className="w-full h-full object-contain" />,
    to: "/admin/reward-catalog",
    variant: "gold",
    iconAsImage: true,
  },
];

/** Role dashboard links so admin can navigate the entire app from Admin. */
export const ADMIN_ROLE_DASHBOARDS_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "General Foreman Dashboard",
    description: "Crew oversight, safety compliance, equipment logs.",
    icon: <img loading="lazy" src="/assets/general-foreman-panel.webp" alt="" className="w-full h-full object-contain" />,
    to: "/general-foreman-dashboard",
    variant: "purple",
    iconAsImage: true,
  },
  {
    title: "Foreman Dashboard",
    description: "Crew management and daily reports.",
    icon: <img loading="lazy" src="/assets/foreman-panel.webp" alt="" className="w-full h-full object-contain" />,
    to: "/foreman-dashboard",
    variant: "bluewhite",
    iconAsImage: true,
  },
  {
    title: "Safety Officer Dashboard",
    description: "Safety compliance and incident tracking.",
    icon: <img loading="lazy" src="/assets/safety-officer-panel.webp" alt="" className="w-full h-full object-contain" />,
    to: "/safety-officer-dashboard",
    variant: "redwhite",
    iconAsImage: true,
  },
  {
    title: "Mechanic Dashboard",
    description: "DVIR queue and fleet maintenance.",
    icon: <img loading="lazy" src="/assets/mechanic-panel.webp" alt="" className="w-full h-full object-contain" />,
    to: "/mechanic-dashboard",
    variant: "ember",
    iconAsImage: true,
  },
  {
    title: "Main Dashboard",
    description: "Employee hub: jobs, forms, announcements.",
    icon: <img loading="lazy" src="/assets/all-tools.webp" alt="" className="w-full h-full object-contain" />,
    to: "/dashboard",
    variant: "emerald",
    iconAsImage: true,
  },
];

export const MECHANIC_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "Equipment Center",
    description: "Equipment inspection control center.",
    icon: <Wrench className="w-8 h-8 text-[#ff9c63]" />,
    to: "/mechanic-equipment-center",
    variant: "ember",
  },
  {
    title: "Fleet & Equipment Center",
    description: "Review DVIRs and equipment inspections, log repairs.",
    icon: <Wrench className="w-8 h-8 text-[#ffb887]" />,
    to: "/mechanic/equipment-logs",
    variant: "ember",
  },
  {
    title: "Parts & Repairs Log",
    description: "Track maintenance, repairs, and fleet health.",
    icon: <Wrench className="w-8 h-8 text-[#ff8a4b]" />,
    to: "/mechanic/parts-repairs",
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
];

export const GENERAL_FOREMAN_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "Crew Oversight",
    description: "Monitor all crew assignments and progress.",
    icon: <img loading="lazy" src="/assets/crew-oversight.webp" alt="" className="w-full h-full object-contain" />,
    to: "/crew-oversight",
    variant: "purple",
    iconAsImage: true,
  },
  {
    title: "Safety Compliance",
    description: "Review JSA submissions and safety reports.",
    icon: <img loading="lazy" src="/assets/safety-compliance.webp" alt="" className="w-full h-full object-contain" />,
    to: "/general-foreman/safety-compliance",
    variant: "purple",
    iconAsImage: true,
  },
  {
    title: "Equipment Logs",
    description: "View equipment inspections and DVIR status.",
    icon: <img loading="lazy" src="/assets/equipment-logs.webp" alt="" className="w-full h-full object-contain" />,
    to: "/general-foreman/equipment-logs",
    variant: "purple",
    iconAsImage: true,
  },
  {
    title: "Employee Attendance",
    description: "Track daily attendance for all crew members.",
    icon: <img loading="lazy" src="/assets/crew-oversight.webp" alt="" className="w-full h-full object-contain" />,
    to: "/general-foreman/attendance",
    variant: "purple",
    iconAsImage: true,
  },
];

export const SAFETY_OFFICER_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "OSHA 300A Summary",
    description: "Annual summary of work-related injuries and illnesses; certify and export.",
    icon: <FileText className="w-8 h-8 text-[#fecaca]" />,
    to: "/safety-officer/osha-300a",
    variant: "redwhite",
  },
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

