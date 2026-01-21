import { useAuth } from "../contexts/AuthContext";
import {
  FileText,
  Megaphone,
  Phone,
  Shield,
  FileSearch,
  Wrench,
  Briefcase,
  HardHat,
  Users,
  History,
  UserCircle,
  Settings,
} from "lucide-react";
import BrandedNavCard from "./BrandedNavCard";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { usePinnedFavorites } from "./dashboard";

const userPages = [
  {
    id: "jobs",
    label: "My Jobs",
    path: "/assigned-jobs",
    icon: Briefcase,
    description: "View and track your assigned work"
  },
  {
    id: "forms",
    label: "Company Forms",
    path: "/forms",
    icon: FileText,
    description: "Access and submit required ATTS forms"
  },
  {
    id: "history",
    label: "Forms History",
    path: "/forms-history",
    icon: History,
    description: "View your past form submissions"
  },
  {
    id: "announcements",
    label: "Announcements",
    path: "/announcements",
    icon: Megaphone,
    description: "Latest company news and updates"
  },
  {
    id: "resources",
    label: "Resources",
    path: "/resources",
    icon: FileSearch,
    description: "Training materials and documents"
  },
  {
    id: "contact",
    label: "Contact",
    path: "/contact",
    icon: Phone,
    description: "Reach out to management and HR"
  },
  {
    id: "profile",
    label: "My Profile",
    path: "/profile",
    icon: UserCircle,
    description: "View credentials and settings"
  },
  {
    id: "settings",
    label: "Settings",
    path: "/settings",
    icon: Settings,
    description: "Manage saved data and preferences"
  },
];

export default function NavCards() {
  const { isAdmin, hasMechanicAccess, role } = useAuth();
  const { togglePin, isPinned, canPinMore } = usePinnedFavorites();
  
  // Get device capabilities for mobile optimization
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

  // Stagger animation - faster/simpler on mobile
  const containerVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : (caps.isMobile ? 0.03 : 0.05),
        delayChildren: shouldReduceMotion ? 0 : 0.05,
      },
    },
  }), [caps.isMobile, shouldReduceMotion]);

  const itemVariants = useMemo(() => ({
    hidden: { 
      opacity: 0, 
      y: shouldReduceMotion ? 0 : 6 
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: shouldReduceMotion ? { duration: 0.1 } : {
        type: "spring" as const,
        stiffness: 500,
        damping: 30,
      }
    },
  }), [shouldReduceMotion]);

  // Build the cards array dynamically
  const allCards = [
    ...userPages.map((page) => ({
      key: page.path,
      itemId: page.id,
      title: page.label,
      description: page.description,
      icon: page.icon,
      to: page.path,
      variant: "emerald" as const,
      show: true,
    })),
    {
      key: "/mechanic-dashboard",
      itemId: "mechanic",
      title: "Mechanic Panel",
      description: "Review DVIR queues and shop work",
      icon: Wrench,
      to: "/mechanic-dashboard",
      variant: "ember" as const,
      show: hasMechanicAccess,
    },
    {
      key: "/general-foreman-dashboard",
      itemId: "general-foreman",
      title: "General Foreman Panel",
      description: "Oversee crews and safety compliance",
      icon: HardHat,
      to: "/general-foreman-dashboard",
      variant: "purple" as const,
      show: role === "general_foreman" || isAdmin,
    },
    {
      key: "/safety-officer-dashboard",
      itemId: "safety-officer",
      title: "Safety Officer Panel",
      description: "Manage incidents and compliance",
      icon: Shield,
      to: "/safety-officer-dashboard",
      variant: "redwhite" as const,
      show: role === "safety_officer" || isAdmin,
    },
    {
      key: "/foreman-dashboard",
      itemId: "foreman",
      title: "Foreman Panel",
      description: "Manage crew and daily reports",
      icon: Users,
      to: "/foreman-dashboard",
      variant: "bluewhite" as const,
      show: role === "foreman" || isAdmin,
    },
    {
      key: "/admin",
      itemId: "admin",
      title: "Admin Panel",
      description: "Manage users and approvals",
      icon: Shield,
      to: "/admin",
      variant: "gold" as const,
      show: isAdmin,
    },
  ].filter(card => card.show);

  return (
    <motion.div 
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 w-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {allCards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div key={card.key} variants={itemVariants}>
            <BrandedNavCard
              title={card.title}
              description={card.description}
              icon={<Icon />}
              to={card.to}
              variant={card.variant}
              itemId={card.itemId}
              isPinned={isPinned(card.itemId)}
              canPinMore={canPinMore}
              onTogglePin={togglePin}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
