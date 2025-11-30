import {
  CalendarCheck,
  ClipboardList,
  Users,
  Wrench,
  Gauge,
} from "lucide-react";
import type { AdminNavCardConfig } from "./AdminPremiumScaffold";

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
];

export const MECHANIC_NAV_CARDS: AdminNavCardConfig[] = [
  {
    title: "DVIR Center",
    description: "Review driver inspections and log repairs.",
    icon: <ClipboardList className="w-8 h-8 text-[#ffb887]" />,
    to: "/mechanic-dvir-center",
    variant: "ember",
  },
  {
    title: "Preventive Maintenance",
    description: "Schedule PM windows and automate reminders.",
    icon: <Gauge className="w-8 h-8 text-[#ff9c63]" />,
    to: "/mechanic-dashboard#pm",
    variant: "ember",
  },
  {
    title: "Parts & Repairs Log",
    description: "Track usage, repeat issues, and inventory.",
    icon: <Wrench className="w-8 h-8 text-[#ff8a4b]" />,
    to: "/mechanic-dashboard#repairs",
    variant: "ember",
  },
];

