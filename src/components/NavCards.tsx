import { useAuth } from "../contexts/AuthContext";
import BrandedNavCard from "./BrandedNavCard";
import { motion } from "framer-motion";
import React, { useMemo } from "react";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { usePinnedFavorites } from "./dashboard";

interface NavPage {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  description: string;
  iconAsImage: boolean;
}

const IMG = (src: string) => (
  <img loading="lazy" src={src} alt="" className="w-full h-full object-contain" />
);

const categories: { key: string; label: string; items: NavPage[] }[] = [
  {
    key: "daily-work",
    label: "Daily Work",
    items: [
      { id: "jobs", label: "My Jobs", path: "/assigned-jobs", icon: IMG("/assets/my-jobs.webp"), description: "View and track your assigned work", iconAsImage: true },
      { id: "forms", label: "Company Forms", path: "/forms", icon: IMG("/assets/company-forms.webp"), description: "Access and submit required ATTS forms", iconAsImage: true },
      { id: "history", label: "Forms History", path: "/forms-history", icon: IMG("/assets/forms-history.webp"), description: "View your past form submissions", iconAsImage: true },
    ],
  },
  {
    key: "safety",
    label: "Safety & Emergency",
    items: [
      { id: "safety-rewards", label: "Safety Rewards", path: "/safety-rewards", icon: IMG("/assets/safety-rewards.webp"), description: "Monthly raffle entries and prizes", iconAsImage: true },
      { id: "emergency", label: "Emergency Action Plan", path: "/emergency-action-plan", icon: IMG("/assets/emergency-action-plan.webp"), description: "911, emergency contacts, evacuation", iconAsImage: true },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    items: [
      { id: "announcements", label: "Announcements", path: "/announcements", icon: IMG("/assets/announcements.webp"), description: "Latest company news and updates", iconAsImage: true },
      { id: "resources", label: "Resources", path: "/resources", icon: IMG("/assets/resources.webp"), description: "Training materials and documents", iconAsImage: true },
      { id: "contact", label: "Contact", path: "/contact", icon: IMG("/assets/contact.webp"), description: "Reach out to management and HR", iconAsImage: true },
      { id: "team-contacts", label: "Team Contacts", path: "/team-contacts", icon: IMG("/assets/contact.webp"), description: "Call or email any teammate directly", iconAsImage: true },
    ],
  },
  {
    key: "account",
    label: "Account",
    items: [
      { id: "profile", label: "My Profile", path: "/profile", icon: IMG("/assets/my-profile.webp"), description: "View credentials and settings", iconAsImage: true },
      { id: "settings", label: "Settings", path: "/settings", icon: IMG("/assets/settings.webp"), description: "Manage saved data and preferences", iconAsImage: true },
    ],
  },
];

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="col-span-full flex items-center gap-3 pt-3 pb-1 first:pt-0">
      <span className="text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase text-white/30">
        {label}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
    </div>
  );
}

export default function NavCards() {
  const { isAdmin, hasMechanicAccess, role } = useAuth();
  const { togglePin, isPinned, canPinMore } = usePinnedFavorites();
  
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

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
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 6 },
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

  const rolePanels = useMemo(() => [
    {
      key: "/mechanic-dashboard",
      itemId: "mechanic",
      title: "Mechanic Panel",
      description: "Review DVIR queues and shop work",
      icon: IMG("/assets/mechanic-panel.webp"),
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
      icon: IMG("/assets/general-foreman-panel.webp"),
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
      icon: IMG("/assets/safety-officer-panel.webp"),
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
      icon: IMG("/assets/foreman-panel.webp"),
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
      icon: IMG("/assets/admin-panel.webp"),
      to: "/admin",
      variant: "gold" as const,
      show: isAdmin,
      iconAsImage: true,
    },
  ].filter(c => c.show), [isAdmin, hasMechanicAccess, role]);

  return (
    <motion.div 
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3 w-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Role-specific panels first */}
      {rolePanels.length > 0 && (
        <>
          <SectionHeader label="Role Panels" />
          {rolePanels.map((card) => (
            <motion.div key={card.key} variants={itemVariants}>
              <BrandedNavCard
                title={card.title}
                description={card.description}
                icon={card.icon}
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
        </>
      )}

      {/* Categorized user pages */}
      {categories.map((category) => (
        <React.Fragment key={category.key}>
          <SectionHeader label={category.label} />
          {category.items.map((page) => (
            <motion.div key={page.path} variants={itemVariants}>
              <BrandedNavCard
                title={page.label}
                description={page.description}
                icon={page.icon}
                to={page.path}
                variant="emerald"
                iconAsImage={page.iconAsImage}
                itemId={page.id}
                isPinned={isPinned(page.id)}
                canPinMore={canPinMore}
                onTogglePin={togglePin}
              />
            </motion.div>
          ))}
        </React.Fragment>
      ))}
    </motion.div>
  );
}
