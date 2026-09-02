import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  FileText,
  Gauge,
  Gift,
  HardHat,
  History,
  LayoutGrid,
  LifeBuoy,
  Mail,
  Map,
  MessageSquare,
  Phone,
  Settings2,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Siren,
  Trees,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import type { AdminNavCardConfig } from "./AdminPremiumScaffold";

type CardVariant = "emerald" | "gold" | "ember" | "purple" | "redwhite" | "bluewhite";

/**
 * Common nav cards shared across all role dashboards, tinted per role.
 * Icons render inside the LeafGlyph tile — no raster assets.
 */
export function getCommonNavCards(variant: CardVariant): AdminNavCardConfig[] {
  return [
    { title: "My Jobs", description: "View and track your assigned work", icon: <Briefcase />, to: "/assigned-jobs", variant },
    { title: "Company Forms", description: "Access and submit required forms", icon: <ClipboardList />, to: "/forms", variant },
    { title: "Announcements", description: "Latest company news and updates", icon: <Bell />, to: "/announcements", variant },
    { title: "Resources", description: "Training materials and documents", icon: <BookOpen />, to: "/resources", variant },
    { title: "Contact", description: "Reach out to management and HR", icon: <MessageSquare />, to: "/contact", variant },
    { title: "Team Contacts", description: "Call or email any teammate directly", icon: <Phone />, to: "/team-contacts", variant },
    { title: "Forms History", description: "View your past form submissions", icon: <History />, to: "/forms-history", variant },
    {
      title: "Emergency Action Plan",
      description: "911, contacts, evacuation, OSHA reporting",
      icon: <Siren />,
      to: "/emergency-action-plan",
      variant,
    },
    { title: "Safety Rewards", description: "Monthly raffle entries and prizes", icon: <Award />, to: "/safety-rewards", variant },
  ];
}

export const ADMIN_CORE_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "Requests & Oversight",
    description: "RTO, JSA oversight, and parts & fixes in one place.",
    icon: <ClipboardCheck />,
    to: "/admin/requests-oversight",
    variant: "gold",
  },
  {
    title: "Users & Activity",
    description: "Manage accounts and view live engagement.",
    icon: <Users />,
    to: "/admin/users",
    variant: "gold",
  },
  {
    title: "Email Recipients",
    description: "Manage compliance and safety forecast email lists.",
    icon: <Mail />,
    to: "/admin/email-recipients",
    variant: "gold",
  },
  {
    title: "Safety Settings",
    description: "Configure announcements, briefings, and reward points.",
    icon: <Settings2 />,
    to: "/admin/safety-settings",
    variant: "gold",
  },
  {
    title: "Mass SMS",
    description: "Send one SMS to all app users with a phone number.",
    icon: <MessageSquare />,
    to: "/admin/mass-sms",
    variant: "gold",
  },
  {
    title: "Operations Hub",
    description: "Manage work sites, crews, and job assignments.",
    icon: <Map />,
    to: "/admin/operations",
    variant: "gold",
  },
  {
    title: "Job Progress Analytics",
    description: "Span-based production and week-over-week deltas.",
    icon: <TrendingUp />,
    to: "/admin/job-progress",
    variant: "gold",
  },
  {
    title: "Safety & Compliance",
    description: "Analytics · Risk Calibration · Compliance Audit",
    icon: <ShieldCheck />,
    to: "/admin/safety-compliance",
    variant: "gold",
  },
  {
    title: "Telemetry Dashboard",
    description: "Form analytics, engagement metrics, and system health.",
    icon: <Activity />,
    to: "/admin/telemetry",
    variant: "gold",
  },
  {
    title: "Certifications & Qualifications",
    description: "Track certifications, grade tests, manage access, and OSHA 1910.269 electrical levels.",
    icon: <Award />,
    to: "/admin/certifications",
    variant: "gold",
  },
  {
    title: "Emergency Action Plan",
    description: "Site emergency contacts, triage, evacuation, OSHA reporting.",
    icon: <Siren />,
    to: "/emergency-action-plan",
    variant: "gold",
  },
  {
    title: "Safety Rewards",
    description: "Manage monthly raffle prizes and run drawings.",
    icon: <Gift />,
    to: "/admin/safety-rewards",
    variant: "gold",
  },
  {
    title: "Manual Point Awards",
    description: "Grant awarders, audit manual awards, and review caps.",
    icon: <BarChart3 />,
    to: "/admin/manual-awards",
    variant: "gold",
  },
  {
    title: "Redemption Fulfillment",
    description: "Fulfill or deny employee reward store requests.",
    icon: <ShoppingBag />,
    to: "/admin/redemption-fulfillment",
    variant: "gold",
  },
  {
    title: "Reward Catalog",
    description: "Create and manage redemption store items, prices, and images.",
    icon: <LayoutGrid />,
    to: "/admin/reward-catalog",
    variant: "gold",
  },
];

/** Role dashboard links so admin can navigate the entire app from Admin. */
export const ADMIN_ROLE_DASHBOARDS_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "General Foreman Dashboard",
    description: "Crew oversight, safety compliance, equipment logs.",
    icon: <Trees />,
    to: "/general-foreman-dashboard",
    variant: "purple",
  },
  {
    title: "Foreman Dashboard",
    description: "Crew management and daily reports.",
    icon: <HardHat />,
    to: "/foreman-dashboard",
    variant: "bluewhite",
  },
  {
    title: "Safety Officer Dashboard",
    description: "Safety compliance and incident tracking.",
    icon: <Shield />,
    to: "/safety-officer-dashboard",
    variant: "redwhite",
  },
  {
    title: "Mechanic Dashboard",
    description: "DVIR queue and fleet maintenance.",
    icon: <Wrench />,
    to: "/mechanic-dashboard",
    variant: "ember",
  },
  {
    title: "Main Dashboard",
    description: "Employee hub: jobs, forms, announcements.",
    icon: <LayoutGrid />,
    to: "/dashboard",
    variant: "emerald",
  },
];

export const MECHANIC_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "Equipment Center",
    description: "Equipment inspection control center.",
    icon: <Cpu />,
    to: "/mechanic-equipment-center",
    variant: "ember",
  },
  {
    title: "Fleet & Equipment Center",
    description: "Review DVIRs and equipment inspections, log repairs.",
    icon: <Wrench />,
    to: "/mechanic/equipment-logs",
    variant: "ember",
  },
  {
    title: "Parts & Repairs Log",
    description: "Track maintenance, repairs, and fleet health.",
    icon: <LifeBuoy />,
    to: "/mechanic/parts-repairs",
    variant: "ember",
  },
  {
    title: "Preventive Maintenance",
    description: "Schedule PM windows and automate reminders.",
    icon: <Gauge />,
    to: "/mechanic-dashboard#pm",
    variant: "ember",
    comingSoon: true,
  },
];

export const GENERAL_FOREMAN_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "Crew Oversight",
    description: "Monitor all crew assignments and progress.",
    icon: <Users />,
    to: "/crew-oversight",
    variant: "purple",
  },
  {
    title: "Safety Compliance",
    description: "Review JSA submissions and safety reports.",
    icon: <ShieldCheck />,
    to: "/general-foreman/safety-compliance",
    variant: "purple",
  },
  {
    title: "Equipment Logs",
    description: "View equipment inspections and DVIR status.",
    icon: <Wrench />,
    to: "/general-foreman/equipment-logs",
    variant: "purple",
  },
  {
    title: "Employee Attendance",
    description: "Track daily attendance for all crew members.",
    icon: <CalendarCheck />,
    to: "/general-foreman/attendance",
    variant: "purple",
  },
];

export const SAFETY_OFFICER_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "Field Safety Audit",
    description: "Audit a site visit: equipment and crew Pass/Fail checks with escalation.",
    icon: <ClipboardCheck />,
    to: "/safety-officer/field-audit",
    variant: "redwhite",
  },
  {
    title: "Field Audit History",
    description: "Browse past audits and a subject's findings + field-note timeline.",
    icon: <History />,
    to: "/safety-officer/field-audit/history",
    variant: "redwhite",
  },
  {
    title: "OSHA 300A Summary",
    description: "Annual summary of work-related injuries and illnesses; certify and export.",
    icon: <FileText />,
    to: "/safety-officer/osha-300a",
    variant: "redwhite",
  },
  {
    title: "Incident Reports",
    description: "Track and investigate safety incidents.",
    icon: <Shield />,
    to: "/safety-officer-dashboard#incidents",
    variant: "redwhite",
    comingSoon: true,
  },
  {
    title: "JSA Audits",
    description: "Review and approve job safety analyses.",
    icon: <ClipboardList />,
    to: "/safety-officer-dashboard#jsa",
    variant: "redwhite",
    comingSoon: true,
  },
  {
    title: "Training Records",
    description: "Manage safety certifications and training.",
    icon: <Users />,
    to: "/safety-officer-dashboard#training",
    variant: "redwhite",
    comingSoon: true,
  },
];

export const FOREMAN_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "My Crew",
    description: "Manage your assigned crew members.",
    icon: <Users />,
    to: "/foreman-dashboard#crew",
    variant: "bluewhite",
    comingSoon: true,
  },
  {
    title: "Daily Reports",
    description: "Submit and view job progress reports.",
    icon: <ClipboardList />,
    to: "/foreman/daily-reports",
    variant: "bluewhite",
    comingSoon: true,
  },
];
