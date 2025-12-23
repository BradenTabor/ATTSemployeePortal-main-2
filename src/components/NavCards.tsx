import { useAuth } from "../contexts/AuthContext";
import {
  FileText,
  Megaphone,
  Phone,
  Shield,
  FileSearch,
  Wrench,
} from "lucide-react";
import BrandedNavCard from "./BrandedNavCard";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { getDeviceCapabilities } from "../lib/mobilePerf";

const userPages = [
  {
    label: "Company Forms",
    path: "/forms",
    icon: FileText,
    description: "Access and submit required ATTS forms"
  },
  {
    label: "Announcements",
    path: "/announcements",
    icon: Megaphone,
    description: "Latest company news and updates"
  },
  {
    label: "Resources",
    path: "/resources",
    icon: FileSearch,
    description: "Training materials and documents"
  },
  {
    label: "Contact",
    path: "/contact",
    icon: Phone,
    description: "Reach out to management and HR"
  },
];

export default function NavCards() {
  const { isAdmin, hasMechanicAccess } = useAuth();
  
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
        type: "spring",
        stiffness: 500,
        damping: 30,
      }
    },
  }), [shouldReduceMotion]);

  // Build the cards array dynamically
  const allCards = [
    ...userPages.map((page) => ({
      key: page.path,
      title: page.label,
      description: page.description,
      icon: page.icon,
      to: page.path,
      variant: "emerald" as const,
      show: true,
    })),
    {
      key: "/mechanic-dashboard",
      title: "Mechanic Panel",
      description: "Review DVIR queues and shop work",
      icon: Wrench,
      to: "/mechanic-dashboard",
      variant: "ember" as const,
      show: hasMechanicAccess,
    },
    {
      key: "/admin",
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
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3 w-full"
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
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
