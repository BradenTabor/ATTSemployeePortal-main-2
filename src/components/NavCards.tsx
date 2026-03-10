import { useAuth } from "../contexts/AuthContext";
import BrandedNavCard from "./BrandedNavCard";
import { motion } from "framer-motion";
import React, { useMemo } from "react";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { usePinnedFavorites } from "./dashboard";

const userPages = [
  {
    id: "jobs",
    label: "My Jobs",
    path: "/assigned-jobs",
    icon: <img loading="lazy" src="/assets/my-jobs.png" alt="" className="w-full h-full object-contain" />,
    description: "View and track your assigned work",
    iconAsImage: true,
  },
  {
    id: "forms",
    label: "Company Forms",
    path: "/forms",
    icon: <img loading="lazy" src="/assets/company-forms.png" alt="" className="w-full h-full object-contain" />,
    description: "Access and submit required ATTS forms",
    iconAsImage: true,
  },
  {
    id: "history",
    label: "Forms History",
    path: "/forms-history",
    icon: <img loading="lazy" src="/assets/forms-history.png" alt="" className="w-full h-full object-contain" />,
    description: "View your past form submissions",
    iconAsImage: true,
  },
  {
    id: "announcements",
    label: "Announcements",
    path: "/announcements",
    icon: <img loading="lazy" src="/assets/announcements.png" alt="" className="w-full h-full object-contain" />,
    description: "Latest company news and updates",
    iconAsImage: true,
  },
  {
    id: "resources",
    label: "Resources",
    path: "/resources",
    icon: <img loading="lazy" src="/assets/resources.png" alt="" className="w-full h-full object-contain" />,
    description: "Training materials and documents",
    iconAsImage: true,
  },
  {
    id: "contact",
    label: "Contact",
    path: "/contact",
    icon: <img loading="lazy" src="/assets/contact.png" alt="" className="w-full h-full object-contain" />,
    description: "Reach out to management and HR",
    iconAsImage: true,
  },
  {
    id: "emergency",
    label: "Emergency Action Plan",
    path: "/emergency-action-plan",
    icon: <img loading="lazy" src="/assets/emergency-action-plan.webp" alt="" className="w-full h-full object-contain" />,
    description: "911, emergency contacts, evacuation procedures",
    iconAsImage: true,
  },
  {
    id: "safety-rewards",
    label: "Safety Rewards",
    path: "/safety-rewards",
    icon: <img loading="lazy" src="/assets/safety-rewards.png" alt="" className="w-full h-full object-contain" />,
    description: "Monthly raffle entries and prizes",
    iconAsImage: true,
  },
  {
    id: "profile",
    label: "My Profile",
    path: "/profile",
    icon: <img loading="lazy" src="/assets/my-profile.png" alt="" className="w-full h-full object-contain" />,
    description: "View credentials and settings",
    iconAsImage: true,
  },
  {
    id: "settings",
    label: "Settings",
    path: "/settings",
    icon: <img loading="lazy" src="/assets/settings.png" alt="" className="w-full h-full object-contain" />,
    description: "Manage saved data and preferences",
    iconAsImage: true,
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
      iconAsImage: 'iconAsImage' in page ? page.iconAsImage : false,
    })),
    {
      key: "/mechanic-dashboard",
      itemId: "mechanic",
      title: "Mechanic Panel",
      description: "Review DVIR queues and shop work",
      icon: <img loading="lazy" src="/assets/mechanic-panel.png" alt="" className="w-full h-full object-contain" />,
      to: "/mechanic-dashboard",
      variant: "ember" as const,
      show: hasMechanicAccess,
      iconAsImage: true,
    },
    {
      key: "/general-foreman-dashboard",
      itemId: "general-foreman",
      title: "General Foreman Panel",
      description: "Oversee crews and safety compliance",
      icon: <img loading="lazy" src="/assets/general-foreman-panel.png" alt="" className="w-full h-full object-contain" />,
      to: "/general-foreman-dashboard",
      variant: "purple" as const,
      show: role === "general_foreman" || isAdmin,
      iconAsImage: true,
    },
    {
      key: "/safety-officer-dashboard",
      itemId: "safety-officer",
      title: "Safety Officer Panel",
      description: "Manage incidents and compliance",
      icon: <img loading="lazy" src="/assets/safety-officer-panel.png" alt="" className="w-full h-full object-contain" />,
      to: "/safety-officer-dashboard",
      variant: "redwhite" as const,
      show: role === "safety_officer" || isAdmin,
      iconAsImage: true,
    },
    {
      key: "/foreman-dashboard",
      itemId: "foreman",
      title: "Foreman Panel",
      description: "Manage crew and daily reports",
      icon: <img loading="lazy" src="/assets/foreman-panel.png" alt="" className="w-full h-full object-contain" />,
      to: "/foreman-dashboard",
      variant: "bluewhite" as const,
      show: role === "foreman" || isAdmin,
      iconAsImage: true,
    },
    {
      key: "/admin",
      itemId: "admin",
      title: "Admin Panel",
      description: "Manage users and approvals",
      icon: <img loading="lazy" src="/assets/admin-panel.png" alt="" className="w-full h-full object-contain" />,
      to: "/admin",
      variant: "gold" as const,
      show: isAdmin,
      iconAsImage: true,
    },
  ].filter(card => card.show);

  return (
    <motion.div 
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 w-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {allCards.map((card) => (
          <motion.div key={card.key} variants={itemVariants}>
            <BrandedNavCard
              title={card.title}
              description={card.description}
              icon={typeof card.icon === 'function' ? (() => { const Icon = card.icon as React.ComponentType; return <Icon />; })() : card.icon}
              to={card.to}
              variant={card.variant}
              iconAsImage={card.iconAsImage}
              itemId={card.itemId}
              isPinned={isPinned(card.itemId)}
              canPinMore={canPinMore}
              onTogglePin={togglePin}
            />
          </motion.div>
        ))}
    </motion.div>
  );
}
