import { useAuth } from "../contexts/AuthContext";
import BrandedNavCard from "./BrandedNavCard";
import { motion } from "framer-motion";
import React, { useMemo } from "react";
import {
  Bell,
  BookOpen,
  Briefcase,
  ClipboardList,
  Crown,
  HardHat,
  History,
  MessageSquare,
  Phone,
  Settings,
  Shield,
  Siren,
  Award,
  Trees,
  UserCircle2,
  Wrench,
} from "lucide-react";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { usePinnedFavorites } from "../hooks/usePinnedFavorites";
import { Eyebrow } from "./canopy/Eyebrow";
import { unfurlContainer, staggerItem, reducedMotionFade } from "../motion/presets";

interface NavPage {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  description: string;
}

const categories: { key: string; label: string; items: NavPage[] }[] = [
  {
    key: "daily-work",
    label: "Daily Work",
    items: [
      { id: "jobs", label: "My Jobs", path: "/assigned-jobs", icon: <Briefcase />, description: "View and track your assigned work" },
      { id: "forms", label: "Company Forms", path: "/forms", icon: <ClipboardList />, description: "Access and submit required ATTS forms" },
      { id: "history", label: "Forms History", path: "/forms-history", icon: <History />, description: "View your past form submissions" },
    ],
  },
  {
    key: "safety",
    label: "Safety & Emergency",
    items: [
      { id: "safety-rewards", label: "Safety Rewards", path: "/safety-rewards", icon: <Award />, description: "Monthly raffle entries and prizes" },
      { id: "emergency", label: "Emergency Action Plan", path: "/emergency-action-plan", icon: <Siren />, description: "911, emergency contacts, evacuation" },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    items: [
      { id: "announcements", label: "Announcements", path: "/announcements", icon: <Bell />, description: "Latest company news and updates" },
      { id: "resources", label: "Resources", path: "/resources", icon: <BookOpen />, description: "Training materials and documents" },
      { id: "contact", label: "Contact", path: "/contact", icon: <MessageSquare />, description: "Reach out to management and HR" },
      { id: "team-contacts", label: "Team Contacts", path: "/team-contacts", icon: <Phone />, description: "Call or email any teammate directly" },
    ],
  },
  {
    key: "account",
    label: "Account",
    items: [
      { id: "profile", label: "My Profile", path: "/profile", icon: <UserCircle2 />, description: "View credentials and settings" },
      { id: "settings", label: "Settings", path: "/settings", icon: <Settings />, description: "Manage saved data and preferences" },
    ],
  },
];

export default function NavCards() {
  const { isAdmin, hasMechanicAccess, role } = useAuth();
  const { togglePin, isPinned, canPinMore } = usePinnedFavorites();

  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

  const containerVariants = shouldReduceMotion ? reducedMotionFade : unfurlContainer;
  const itemVariants = shouldReduceMotion ? reducedMotionFade : staggerItem;

  const rolePanels = useMemo(
    () =>
      [
        {
          key: "/mechanic-dashboard",
          itemId: "mechanic",
          title: "Mechanic Panel",
          description: "Review DVIR queues and shop work",
          icon: <Wrench />,
          to: "/mechanic-dashboard",
          variant: "ember" as const,
          show: hasMechanicAccess,
        },
        {
          key: "/general-foreman-dashboard",
          itemId: "general-foreman",
          title: "General Foreman Panel",
          description: "Oversee crews and safety compliance",
          icon: <Trees />,
          to: "/general-foreman-dashboard",
          variant: "purple" as const,
          show: role === "general_foreman" || isAdmin,
        },
        {
          key: "/safety-officer-dashboard",
          itemId: "safety-officer",
          title: "Safety Officer Panel",
          description: "Manage incidents and compliance",
          icon: <Shield />,
          to: "/safety-officer-dashboard",
          variant: "redwhite" as const,
          show: role === "safety_officer" || isAdmin,
        },
        {
          key: "/foreman-dashboard",
          itemId: "foreman",
          title: "Foreman Panel",
          description: "Manage crew and daily reports",
          icon: <HardHat />,
          to: "/foreman-dashboard",
          variant: "bluewhite" as const,
          show: role === "foreman" || isAdmin,
        },
        {
          key: "/admin",
          itemId: "admin",
          title: "Admin Panel",
          description: "Manage users and approvals",
          icon: <Crown />,
          to: "/admin",
          variant: "gold" as const,
          show: isAdmin,
        },
      ].filter((c) => c.show),
    [isAdmin, hasMechanicAccess, role]
  );

  let sectionIndex = 0;

  return (
    <motion.div
      className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {rolePanels.length > 0 && (
        <>
          <Eyebrow index={++sectionIndex} className="col-span-full pb-1 pt-2 first:pt-0" tone="bone">
            Role Panels
          </Eyebrow>
          {rolePanels.map((card) => (
            <motion.div key={card.key} variants={itemVariants}>
              <BrandedNavCard
                title={card.title}
                description={card.description}
                icon={card.icon}
                to={card.to}
                variant={card.variant}
                itemId={card.itemId}
                isPinned={isPinned(card.itemId)}
                canPinMore={canPinMore}
                onTogglePin={togglePin}
              />
            </motion.div>
          ))}
        </>
      )}

      {categories.map((category) => (
        <React.Fragment key={category.key}>
          <Eyebrow index={++sectionIndex} className="col-span-full pb-1 pt-3 first:pt-0" tone="bone">
            {category.label}
          </Eyebrow>
          {category.items.map((page) => (
            <motion.div key={page.path} variants={itemVariants}>
              <BrandedNavCard
                title={page.label}
                description={page.description}
                icon={page.icon}
                to={page.path}
                variant="emerald"
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
