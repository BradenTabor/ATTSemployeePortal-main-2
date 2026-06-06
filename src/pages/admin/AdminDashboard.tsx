import { useMemo, useState, FormEvent, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useModalOverlay } from "../../hooks/useModalOverlay";
import { Shield, Megaphone, Inbox, X, Filter, Pencil, Bell, ChevronDown } from "lucide-react";
import IncidentLoggingModal from "../../components/admin/IncidentLoggingModal";
import SafetyIncidentsList from "../../components/admin/SafetyIncidentsList";
import DashboardLayout from "../../layouts/DashboardLayout";
import { ADMIN_CORE_NAV_CARDS, ADMIN_ROLE_DASHBOARDS_NAV_CARDS } from "../../components/admin/adminNavConfig";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { GoldCollapsibleSection } from "../../components/admin/GoldCollapsibleSection";
import { AdminSegmentedControl, type SegmentTab } from "../../components/admin/AdminSegmentedControl";
import { AdminManualNotifications } from "../../components/admin/AdminManualNotifications";
import { EnableNotificationsButton } from "../../components/notifications";
import BrandedNavCard from "../../components/BrandedNavCard";
import { AvatarDropdownPortal } from "../../components/dashboard/AvatarDropdownPortal";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { subscribeToTableChanges } from "../../lib/realtime";
import { logger } from "../../lib/logger";
import { DateField } from "../../components/forms/GlassyPickers";
import {
  useAnnouncementsQuery,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  type Announcement,
} from "../../hooks/queries/useAnnouncementsQuery";

// Storage key for persisting active tab
const ACTIVE_TAB_STORAGE_KEY = "atts:admin:dashboard:activeTab";

// Base tab configuration (counts added dynamically)
// Tab icons use inline width/height so size applies even if Tailwind is cached
const TAB_ICON_SIZE = 44;
const BASE_DASHBOARD_TABS = [
  { id: "control-panel", label: "Control Panel", shortLabel: "Control", icon: <img loading="lazy" src="/assets/control-panel.webp" alt="" className="object-contain flex-shrink-0" style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, minWidth: TAB_ICON_SIZE, minHeight: TAB_ICON_SIZE }} /> },
  { id: "announcements", label: "Announcements", shortLabel: "News", icon: <img loading="lazy" src="/assets/news-announcements.webp" alt="" className="object-contain flex-shrink-0" style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, minWidth: TAB_ICON_SIZE, minHeight: TAB_ICON_SIZE }} /> },
  { id: "requests", label: "Contact Requests", shortLabel: "Requests", icon: <img loading="lazy" src="/assets/contact-requests.webp" alt="" className="object-contain flex-shrink-0" style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, minWidth: TAB_ICON_SIZE, minHeight: TAB_ICON_SIZE }} /> },
  { id: "notifications", label: "Push Notifications", shortLabel: "Push", icon: <img loading="lazy" src="/assets/push-notifications.webp" alt="" className="object-contain flex-shrink-0" style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, minWidth: TAB_ICON_SIZE, minHeight: TAB_ICON_SIZE }} /> },
];

// Animation variants - spring physics per taste-skill (stiffness: 100, damping: 20)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 20,
    },
  },
};

// Tab content animation variants
const tabContentVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 22,
    }
  },
  exit: { 
    opacity: 0, 
    y: -6,
    transition: {
      duration: 0.15,
    }
  },
};

type ContactRequest = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  submitted_at: string;
};

const CONTACT_TOPIC_LABELS: Record<string, string> = {
  general: "General",
  hr: "HR",
  safety: "Safety",
  payroll: "Payroll",
};

function ContactRequestModalContent({
  request,
  onClose,
}: {
  request: ContactRequest;
  onClose: () => void;
}) {
  const { modalRef, zIndex } = useModalOverlay({ isOpen: true, onClose, zIndex: 100 });
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 flex items-center justify-center px-4 py-8"
        style={{ zIndex }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        aria-hidden
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-request-title"
          className="relative w-full max-w-lg rounded-2xl border border-[#f4c979]/15 bg-[#0e0c09]/95 backdrop-blur-xl p-5 text-white shadow-[0_30px_60px_rgba(0,0,0,0.6)] space-y-4"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                id="contact-request-title"
                className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#f4c979]/80"
              >
                Contact message
              </p>
              <p className="text-xl font-bold tracking-tight text-white mt-1">{request.name}</p>
              <a
                href={`mailto:${request.email}`}
                className="text-xs text-[#f4c979]/70 hover:text-white transition-colors"
              >
                {request.email}
              </a>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/8 bg-white/[0.04] p-2 text-white/50 hover:text-white hover:bg-white/8 transition"
              aria-label="Close full message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] text-white/50 uppercase tracking-[0.2em]">
              <span>{CONTACT_TOPIC_LABELS[request.topic] ?? request.topic}</span>
              <span>{new Date(request.submitted_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
              {request.message}
            </p>
          </div>
          <div className="flex justify-end hover:scale-[1.02]">
            <motion.button
              type="button"
              onClick={onClose}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] px-4 py-2 text-sm font-semibold text-[#2e1b02] shadow-[0_6px_16px_rgba(244,201,121,0.2)] transition"
            >
              Close
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper to get persisted tab or default
function getPersistedTab(): string {
  if (typeof window === 'undefined') return "control-panel";
  try {
    const stored = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    if (stored && BASE_DASHBOARD_TABS.some((t: { id: string }) => t.id === stored)) {
      return stored;
    }
  } catch {
    // localStorage disabled
  }
  return "control-panel";
}

// Helper to persist tab selection
function persistTab(tabId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tabId);
  } catch {
    // localStorage disabled
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { session, role, signOut, setSession, avatarUrl } = useAuth();
  const isAdmin = role === "admin";

  // Active tab state with persistence
  const [activeTab, setActiveTab] = useState(() => getPersistedTab());

  // Handle tab change with persistence
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    persistTab(tabId);
  }, []);

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      logger.error("[AdminDashboard] Sign out failed:", error);
    }
  }, [navigate, setSession, signOut]);

  // Announcement form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [publishDate, setPublishDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  // Contact requests state
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState<string | null>(null);
  const [expandedRequest, setExpandedRequest] = useState<ContactRequest | null>(null);
  const [contactTopicFilter, setContactTopicFilter] = useState<string>("all");

  // Edit mode state for announcements
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  
  // Incident logging modal state
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  // Nav cards expand/collapse state
  const [showAllNavCards, setShowAllNavCards] = useState(false);
  const VISIBLE_NAV_CARD_COUNT = 6;

  // Announcement hooks
  const { data: announcements, isLoading: announcementsLoading } = useAnnouncementsQuery(10);
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;
  
  // Display name
  const displayName = useMemo(() => session?.user?.email?.split("@")[0] || "Admin", [session?.user?.email]);

  // Dynamic tabs with badge counts
  const DASHBOARD_TABS: SegmentTab[] = useMemo(() => {
    return BASE_DASHBOARD_TABS.map(tab => {
      if (tab.id === "requests" && contactRequests.length > 0) {
        return { ...tab, badgeCount: contactRequests.length };
      }
      if (tab.id === "announcements" && composerOpen) {
        return { ...tab, hasNotification: true };
      }
      return tab;
    });
  }, [contactRequests.length, composerOpen]);

  // Fetch contact requests
  useEffect(() => {
    if (!isAdmin) return;
    let isMounted = true;

    const fetchContactRequests = async () => {
      try {
        const { data, error } = await supabase
          .from("contact_requests")
          .select("id,name,email,topic,message,submitted_at")
          .order("submitted_at", { ascending: false })
          .limit(6);

        if (!isMounted) return;

        if (error) {
          logger.error("Failed to load contact requests:", error);
          setContactError("Unable to load recent contact requests.");
          setContactRequests([]);
        } else {
          setContactRequests(data || []);
          setContactError(null);
        }
      } catch (err) {
        if (!isMounted) return;
        logger.error("Unexpected contact request error:", err);
        setContactError("Something went wrong while fetching contact requests.");
        setContactRequests([]);
      } finally {
        if (isMounted) {
          setContactLoading(false);
        }
      }
    };

    fetchContactRequests();
    
    // Use realtime subscription instead of polling for better performance
    const unsubscribe = subscribeToTableChanges({
      channelName: "admin-contact-requests",
      table: "contact_requests",
      onInsert: () => {
        if (isMounted) fetchContactRequests();
      },
      onUpdate: () => {
        if (isMounted) fetchContactRequests();
      },
      onDelete: () => {
        if (isMounted) fetchContactRequests();
      },
      onError: (err) => logger.error("Contact requests realtime error:", err),
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isAdmin]);

  const isValid = title.trim().length > 0 && message.trim().length > 0;

  // Reset form to create mode
  const resetToCreateMode = () => {
    setIsEditMode(false);
    setEditingAnnouncement(null);
    setTitle("");
    setMessage("");
    setScheduleLater(false);
    setPublishDate("");
    setFeedback(null);
  };

  // Load announcement into form for editing
  const handleEditAnnouncement = (announcement: Announcement) => {
    setComposerOpen(true);
    setIsEditMode(true);
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setMessage(announcement.message);
    // Handle date: check if it differs from today
    const today = new Date().toISOString().slice(0, 10);
    if (announcement.date !== today) {
      setScheduleLater(true);
      setPublishDate(announcement.date);
    } else {
      setScheduleLater(false);
      setPublishDate("");
    }
    setFeedback(null);
  };

  const handleCreateAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) {
      setFeedback({ type: "error", message: "Title and message are required." });
      return;
    }

    const payload = {
      title: title.trim(),
      message: message.trim(),
      author: session?.user?.email ?? "Admin Team",
      date:
        scheduleLater && publishDate
          ? publishDate
          : new Date().toISOString().slice(0, 10),
    };

    try {
      setSubmitting(true);
      setFeedback(null);

      if (isEditMode && editingAnnouncement) {
        // UPDATE existing announcement
        await updateAnnouncement.mutateAsync({
          id: editingAnnouncement.id,
          ...payload,
        });
        setFeedback({
          type: "success",
          message: "Announcement updated successfully.",
        });
        resetToCreateMode();
      } else {
        // CREATE new announcement (hook handles notification + toast)
        await createAnnouncement.mutateAsync(payload);
        setFeedback({
          type: "success",
          message: "Announcement published successfully.",
        });
        setTitle("");
        setMessage("");
        setScheduleLater(false);
        setPublishDate("");
      }
    } catch (err) {
      logger.error("Failed to save announcement:", err);
      setFeedback({
        type: "error",
        message: "Something went wrong. Please try again shortly.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredContactRequests = useMemo(() => {
    if (contactTopicFilter === "all") return contactRequests;
    return contactRequests.filter((request) => request.topic === contactTopicFilter);
  }, [contactRequests, contactTopicFilter]);

  // ============================================================
  // TAB CONTENT RENDERERS
  // ============================================================

  // Control Panel Tab Content
  const renderControlPanelTab = () => {
    const visibleCards = showAllNavCards 
      ? ADMIN_CORE_NAV_CARDS 
      : ADMIN_CORE_NAV_CARDS.slice(0, VISIBLE_NAV_CARD_COUNT);
    const hiddenCount = ADMIN_CORE_NAV_CARDS.length - VISIBLE_NAV_CARD_COUNT;

    return (
      <motion.div
        key="control-panel"
        variants={tabContentVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="space-y-4"
      >
        {/* Role dashboards — horizontal scroll on mobile, compact row on desktop */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="space-y-1.5"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#f8e5bb]/60 px-0.5">
            Navigate app
          </p>
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1 sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:overflow-visible sm:pb-0">
            {ADMIN_ROLE_DASHBOARDS_NAV_CARDS.map((card, index) => (
              <motion.div 
                key={card.to} 
                variants={itemVariants} 
                custom={index}
                className="snap-center flex-none w-[65%] sm:w-auto sm:flex-auto"
              >
                <BrandedNavCard
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  to={card.to}
                  variant={card.variant ?? "gold"}
                  compact
                  iconAsImage={card.iconAsImage}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Admin core nav cards — bento grid on desktop, stacked on mobile */}
        <motion.div 
          className="grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {visibleCards.map((card, index) => (
            <motion.div
              key={card.to}
              variants={itemVariants}
              custom={index}
            >
              <BrandedNavCard
                title={card.title}
                description={card.description}
                icon={card.icon}
                to={card.to}
                variant={card.variant ?? "gold"}
                iconAsImage={card.iconAsImage}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Show more / Show less toggle */}
        {hiddenCount > 0 && (
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="flex justify-center hover:scale-[1.03]"
          >
            <motion.button
              type="button"
              onClick={() => setShowAllNavCards(prev => !prev)}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#f4c979]/25 text-[#f8e5bb]/70 text-xs sm:text-sm font-medium transition-colors hover:text-[#f8e5bb] hover:border-[#f4c979]/40 hover:bg-white/[0.03]"
            >
              {showAllNavCards ? "Show less" : `Show ${hiddenCount} more`}
              <motion.span
                animate={{ rotate: showAllNavCards ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.span>
            </motion.button>
          </motion.div>
        )}
        
        {/* Safety Incidents Section */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
        >
          <SafetyIncidentsList onLogIncident={() => setShowIncidentModal(true)} />
        </motion.div>
      </motion.div>
    );
  };

  // Announcements Tab Content
  const renderAnnouncementsTab = () => (
    <motion.div
      key="announcements"
      variants={tabContentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <section className="rounded-2xl sm:rounded-3xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#14110d]/95 via-[#0b0906]/95 to-[#050403]/95 p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4 shadow-[0_20px_40px_rgba(0,0,0,0.5)] relative overflow-hidden backdrop-blur-xl">
        {/* Single ambient glow overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,228,189,0.05),transparent_50%)]" />
        
        <div className="relative flex flex-col gap-2.5 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 bg-[#fef3d1]/8 border border-[#f6dcb2]/30 rounded-full text-[0.6rem] sm:text-[0.65rem] font-semibold tracking-[0.2em] uppercase text-[#f8dfb3] mb-1.5 sm:mb-3">
              {isEditMode ? (
                <Pencil className="w-3 h-3 text-[#f5cf82]" />
              ) : (
                <Megaphone className="w-3 h-3 text-[#f5cf82]" />
              )}
              {isEditMode ? "Edit" : "Publish"}
            </div>
            <h3 className="text-sm sm:text-lg md:text-xl font-bold tracking-tight text-white">
              {isEditMode ? "Edit Announcement" : "Create Announcement"}
            </h3>
            <p className="hidden sm:block text-xs sm:text-sm text-[#f8e5bb]/60 mt-0.5 leading-relaxed max-w-lg hover:scale-[1.02]">
              {isEditMode
                ? "Update the details below and save your changes."
                : "Publish news that appears instantly on the announcements page."}
            </p>
          </div>
          <motion.button
            type="button"
            onClick={() => setComposerOpen(true)}
            disabled={composerOpen}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-transparent bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-[#332308] shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0b09] disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px]"
            aria-expanded={composerOpen ? "true" : "false"}
          >
            <span className="sm:hidden">+ New</span>
            <span className="hidden sm:inline">Create New Announcement</span>
          </motion.button>
        </div>

        {composerOpen ? (
          <div className="relative space-y-3">
            {feedback && (
              <div
                className={`rounded-xl px-3 py-2 text-xs sm:text-sm ${
                  feedback.type === "success"
                    ? "bg-[#1d1a14] text-[#f4d589] border border-[#f4d589]/40"
                    : "bg-[#2b1414] text-[#f2a4a4] border border-[#f47373]/30"
                }`}
              >
                {feedback.message}
              </div>
            )}

            <form
              aria-label={isEditMode ? "Edit announcement form" : "Create announcement form"}
              className={`space-y-3 ${isEditMode ? "ring-1 ring-[#f4c979]/40 rounded-xl p-3 sm:p-4" : ""}`}
              onSubmit={handleCreateAnnouncement}
            >
              {isEditMode && editingAnnouncement && (
                <div className="flex items-center gap-2 text-xs text-[#f4c979] pb-2 border-b border-[#f4c979]/15">
                  <Pencil className="w-3 h-3" />
                  <span className="truncate">Editing: <strong>{editingAnnouncement.title}</strong></span>
                </div>
              )}
              <div className="space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="text-[10px] uppercase tracking-[0.25em] text-[#f3d9a4]/60 block mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. New safety protocols"
                    className="w-full bg-[#050402]/80 border border-[#f6dcb2]/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030201] min-h-[44px]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase tracking-[0.25em] text-[#f3d9a4]/60 block mb-1.5">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share the details your team should know..."
                    rows={3}
                    className="w-full bg-[#050402]/80 border border-[#f6dcb2]/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030201] resize-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <label className="inline-flex items-center gap-2 text-xs text-[#f8e5bb]/70">
                  <input
                    type="checkbox"
                    checked={scheduleLater}
                    onChange={(e) => setScheduleLater(e.target.checked)}
                    className="accent-[#f4c979] w-4 h-4"
                  />
                  Schedule publish date
                </label>
                {scheduleLater && (
                  <div className="flex-1 max-w-xs">
                    <DateField
                      label="Publish Date"
                      value={publishDate}
                      onChange={(e) => setPublishDate(e.target.value)}
                      helperText="Goes live at 12:01 AM"
                      containerClassName="text-white"
                      labelClassName="text-[0.65rem] uppercase tracking-[0.3em] text-[#f3d9a4]/60"
                      variant="gold"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1 hover:scale-[1.01]">
                <motion.button
                  type="submit"
                  disabled={!isValid || submitting || (isEditMode && updateAnnouncement.isPending)}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02] text-sm font-semibold transition border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050301] disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {submitting || (isEditMode && updateAnnouncement.isPending)
                    ? (isEditMode ? "Updating..." : "Publishing...")
                    : (isEditMode ? "Update" : "Publish")}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => {
                    setComposerOpen(false);
                    if (isEditMode) resetToCreateMode();
                  }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#f4c979]/25 text-[#f4c979] text-sm font-semibold transition hover:bg-[#f4c979]/8 focus-visible:outline-none min-h-[44px]"
                >
                  {isEditMode ? "Cancel" : "Hide"}
                </motion.button>
              </div>
              {(submitting || (isEditMode && updateAnnouncement.isPending)) && (
                <div className="h-0.5 w-full rounded-full bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] animate-pulse" />
              )}
            </form>
          </div>
        ) : (
          <p className="relative text-xs text-[#f8e5bb]/50 border-t border-white/5 pt-3">
            Open composer to publish an update.
          </p>
        )}

        {/* Recent Announcements List */}
        <div className="relative border-t border-white/5 pt-3 sm:pt-5 mt-1">
          <GoldCollapsibleSection
            id="recent-announcements"
            title="Recent Announcements"
            subtitle="Edit or manage past broadcasts"
            storageKey="recent-announcements-collapsed"
            defaultOpen={true}
            icon={<Megaphone className="w-4 h-4 text-[#f4c979]" />}
          >
            {announcementsLoading ? (
              <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-2.5 sm:space-y-0 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : !announcements || announcements.length === 0 ? (
              <p className="text-xs text-[#f8e5bb]/50">No announcements yet.</p>
            ) : (
              <div className="space-y-1.5 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2 lg:grid-cols-3 max-h-[50vh] overflow-y-auto pr-1 -mr-1 scrollbar-thin scrollbar-thumb-[#f4c979]/15 scrollbar-track-transparent hover:scale-[1.01]">
                {announcements.map((announcement) => {
                  const isEditing = editingAnnouncement?.id === announcement.id;
                  const authorDisplay = announcement.author.includes('@') 
                    ? announcement.author.split('@')[0] 
                    : announcement.author;
                  
                  return (
                    <motion.div
                      key={announcement.id}
                      className={`group relative rounded-lg border transition-all ${
                        isEditing
                          ? "border-[#f4c979]/40 bg-[#f4c979]/8 ring-1 ring-[#f4c979]/25"
                          : "border-white/8 bg-black/20 hover:border-[#f4c979]/25 hover:bg-black/30"
                      }`}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center p-2 sm:p-2.5 gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-white truncate leading-snug">
                            {announcement.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[9px] sm:text-[10px] text-[#f8e5bb]/50">
                            <span className="shrink-0">{announcement.date}</span>
                            <span className="text-[#f4c979]/30">·</span>
                            <span className="truncate">{authorDisplay}</span>
                          </div>
                        </div>
                        
                        <motion.button
                          type="button"
                          onClick={() => handleEditAnnouncement(announcement)}
                          whileTap={{ scale: 0.95 }}
                          className={`shrink-0 flex items-center justify-center rounded-lg border transition-all min-w-[36px] min-h-[36px] p-1.5 ${
                            isEditing
                              ? "border-[#f4c979]/40 bg-[#f4c979]/15 text-[#f4c979]"
                              : "border-[#f4c979]/20 text-[#f4c979]/70 hover:bg-[#f4c979]/8 active:bg-[#f4c979]/15"
                          }`}
                          aria-label={`Edit announcement: ${announcement.title}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                      
                      {isEditing && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#f4c979] shadow-[0_0_6px_rgba(244,201,121,0.7)]">
                          <span className="absolute inset-0 rounded-full bg-[#f4c979] animate-ping opacity-75" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </GoldCollapsibleSection>
        </div>
      </section>
    </motion.div>
  );

  // Contact Requests Tab Content
  const renderContactRequestsTab = () => (
    <motion.div
      key="requests"
      variants={tabContentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <section className="rounded-2xl sm:rounded-3xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#14110d]/95 via-[#0b0906]/95 to-[#050403]/95 p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4 shadow-[0_20px_40px_rgba(0,0,0,0.5)] relative overflow-hidden backdrop-blur-xl">
        {/* Single ambient glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,228,189,0.05),transparent_50%)]" />
        
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 bg-[#fef3d1]/8 border border-[#f6dcb2]/30 rounded-full text-[0.6rem] font-semibold tracking-[0.2em] uppercase text-[#f8dfb3] mb-1.5 sm:mb-3">
              <Inbox className="w-3 h-3 text-[#f5cf82]" />
              Inbox
            </div>
            <h3 className="text-sm sm:text-lg md:text-xl font-bold tracking-tight text-white">
              Contact Requests
            </h3>
            <p className="hidden sm:block text-xs text-[#f8e5bb]/50 mt-0.5 leading-relaxed max-w-lg">
              Messages from the Contact page routed here for follow-up.
            </p>
          </div>
          <span className="text-[10px] text-[#f8e5bb]/50 whitespace-nowrap px-2 py-1 rounded-lg bg-white/[0.04] border border-white/8 shrink-0">
            {contactRequests.length} · live
          </span>
        </div>

        {/* Topic filter pills */}
        {contactRequests.length > 0 && (
          <div className="relative flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
            <Filter className="w-3 h-3 text-[#f4c979]/70 shrink-0" />
            <div className="flex gap-1.5">
              {["all", "general", "hr", "safety", "payroll"].map((topic) => (
                <motion.button
                  key={topic}
                  type="button"
                  onClick={() => setContactTopicFilter(topic)}
                  whileTap={{ scale: 0.95 }}
                  className={`rounded-lg px-2.5 py-1 text-[10px] sm:text-xs font-semibold transition-all whitespace-nowrap ${
                    contactTopicFilter === topic
                      ? "bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02]"
                      : "border border-white/8 text-[#f8e5bb]/60 hover:text-white hover:border-[#f4c979]/30"
                  }`}
                >
                  {topic === "all" ? "All" : CONTACT_TOPIC_LABELS[topic] ?? topic}
                </motion.button>
              ))}
            </div>
            {contactTopicFilter !== "all" && (
              <motion.button
                type="button"
                onClick={() => setContactTopicFilter("all")}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                whileTap={{ scale: 0.95 }}
                className="text-[10px] font-semibold text-[#f8e5bb]/50 hover:text-white transition-colors inline-flex items-center gap-0.5 shrink-0"
              >
                <X className="w-2.5 h-2.5" />
                Reset
              </motion.button>
            )}
          </div>
        )}

        {contactError && (
          <div className="rounded-xl border border-[#f47373]/30 bg-[#2b1414]/60 text-[#f2a4a4] px-3 py-2 text-xs">
            {contactError}
          </div>
        )}

        {contactLoading ? (
          <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-2.5 sm:space-y-0">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/5 bg-white/[0.03] h-20 sm:h-24 animate-pulse"
              />
            ))}
          </div>
        ) : filteredContactRequests.length === 0 ? (
          <p className="text-xs text-[#f8e5bb]/50 py-2">
            {contactRequests.length === 0
              ? "No contact requests yet."
              : "No requests match this filter."}
          </p>
        ) : (
          <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-2.5 sm:space-y-0">
            {filteredContactRequests.map((request, index) => (
              <motion.article
                key={request.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 100, 
                  damping: 20, 
                  delay: index * 0.04 
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setExpandedRequest(request)}
                className="rounded-xl border border-white/8 bg-black/20 p-3 text-white/85 space-y-1.5 transition-all hover:border-[#f4c979]/25 hover:bg-black/30 cursor-pointer active:bg-black/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-white truncate">{request.name}</p>
                    <a
                      href={`mailto:${request.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-[#f4c979]/80 hover:text-[#ffe6bc] transition-colors truncate block"
                    >
                      {request.email}
                    </a>
                  </div>
                  <span className="text-[8px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-md border border-[#f6dcb2]/20 text-[#f8e5bb]/60 shrink-0">
                    {CONTACT_TOPIC_LABELS[request.topic] ?? request.topic}
                  </span>
                </div>
                <p className="text-xs text-white/60 leading-relaxed line-clamp-2">
                  {request.message}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-[#f8e5bb]/40">
                    {new Date(request.submitted_at).toLocaleString()}
                  </p>
                  <span className="text-[10px] font-medium text-[#f4c979]/60">
                    View →
                  </span>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );

  // Notifications Tab Content
  const renderNotificationsTab = () => (
    <motion.div
      key="notifications"
      variants={tabContentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-3 sm:space-y-5"
    >
      <section className="rounded-2xl sm:rounded-3xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#14110d]/95 via-[#0b0906]/95 to-[#050403]/95 p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4 shadow-[0_20px_40px_rgba(0,0,0,0.5)] relative overflow-hidden backdrop-blur-xl">
        {/* Single ambient glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,228,189,0.05),transparent_50%)]" />
        
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 bg-[#fef3d1]/8 border border-[#f6dcb2]/30 rounded-full text-[0.6rem] font-semibold tracking-[0.2em] uppercase text-[#f8dfb3] mb-1.5 sm:mb-3">
            <Bell className="w-3 h-3 text-[#f5cf82]" />
            Push
          </div>
          <h3 className="text-sm sm:text-lg md:text-xl font-bold tracking-tight text-white">
            Send Push Notification
          </h3>
          <p className="hidden sm:block text-xs text-[#f8e5bb]/50 mt-0.5 leading-relaxed max-w-lg">
            Broadcast important messages directly to users' devices. Target all users, specific roles, or job crews.
          </p>
        </div>
        
        <div className="relative border-t border-white/5 pt-3 sm:pt-5">
          <AdminManualNotifications />
        </div>
      </section>
      
      <div className="flex justify-center">
        <EnableNotificationsButton variant="gold" />
      </div>
    </motion.div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Admin Panel" pageHeading>
      <>
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 pb-4 pt-2 sm:pt-4 md:pt-6">
          {/* Premium Animated Welcome Section with Glass Backdrop - Gold Theme */}
          <div className="mb-3 sm:mb-5 md:mb-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
              className="relative"
            >
              {/* Glass backdrop container - Gold theme */}
              <div 
                className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
                style={{
                  background: 'linear-gradient(145deg, rgba(244, 201, 121, 0.08) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)',
                  backdropFilter: 'blur(24px) saturate(1.6)',
                  WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
                }}
              >
                {/* Glass gloss - single combined layer for performance */}
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(125deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 20%, transparent 45%), radial-gradient(ellipse at 25% 0%, rgba(244, 201, 121, 0.15) 0%, transparent 45%)',
                  }}
                />
                
                {/* Top edge highlight */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-white/5 via-white/20 to-white/5 rounded-t-[inherit]" />

                {/* Content area - tighter mobile padding */}
                <div className="relative px-3 py-2.5 sm:px-5 sm:py-4 md:px-7 md:py-5">
                  {/* Eyebrow - single row with role badge + avatar */}
                  <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-3">
                    <div className="flex items-center gap-1.5">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.15 }}
                        className="flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#f4c979]/12 border border-[#f4c979]/25"
                      >
                        <Shield className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-[#f4c979]" />
                        <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.15em] font-bold text-[#f8e5bb]/90">
                          {role || "Admin"}
                        </span>
                      </motion.div>
                    </div>
                    
                    <AvatarDropdownPortal
                      email={session?.user?.email}
                      role={role}
                      fullName={displayName}
                      avatarUrl={avatarUrl}
                      theme="gold"
                      onSignOut={handleSignOut}
                    />
                  </div>

                  {/* Title area - gold accent line + heading */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <motion.div
                      initial={{ scaleY: 0, opacity: 0 }}
                      animate={{ scaleY: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
                      className="w-0.5 sm:w-1 h-8 sm:h-12 md:h-14 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0"
                      style={{
                        boxShadow: '0 0 16px rgba(244, 201, 121, 0.4)',
                      }}
                    />
                    
                    <div className="flex-1 min-w-0">
                      {enableAnimations ? (
                        <TextEffect
                          as="h1"
                          preset="blurSlide"
                          per="char"
                          delay={0.15}
                          className="text-base sm:text-2xl md:text-3xl font-black tracking-tighter"
                          segmentWrapperClassName="bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent"
                        >
                          {`Welcome back, ${displayName}`}
                        </TextEffect>
                      ) : (
                        <h1 
                          className="text-base sm:text-2xl md:text-3xl font-black tracking-tighter bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent"
                        >
                          {`Welcome back, ${displayName}`}
                        </h1>
                      )}
                      
                      <motion.p
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
                        className="hidden sm:block mt-1 md:mt-1.5 text-xs sm:text-sm text-[#f8e5bb]/45 font-medium leading-relaxed max-w-xl"
                      >
                        Manage users, broadcast announcements, and track mission-critical tools
                      </motion.p>
                    </div>
                  </div>

                  {/* Segmented Control */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 25, delay: 0.35 }}
                    className="mt-2 sm:mt-4 md:mt-5"
                  >
                    <AdminSegmentedControl
                      tabs={DASHBOARD_TABS}
                      activeTab={activeTab}
                      onChange={handleTabChange}
                    />
                  </motion.div>
                </div>
                
                {/* Bottom edge */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/20 to-transparent" />
              </div>
            </motion.div>
          </div>

          {/* Tab Content Area */}
          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              {activeTab === "control-panel" && renderControlPanelTab()}
              {activeTab === "announcements" && renderAnnouncementsTab()}
              {activeTab === "requests" && renderContactRequestsTab()}
              {activeTab === "notifications" && renderNotificationsTab()}
            </AnimatePresence>
          </div>

        </div>

        {/* Incident Logging Modal - portaled so it sits above layout and is clickable */}
        {createPortal(
          <IncidentLoggingModal
            isOpen={showIncidentModal}
            onClose={() => setShowIncidentModal(false)}
          />,
          document.body
        )}

        {/* Contact Request Modal - portaled so it sits above layout */}
        {expandedRequest &&
          createPortal(
            <ContactRequestModalContent
              request={expandedRequest}
              onClose={() => setExpandedRequest(null)}
            />,
            document.body
          )}
      </>
    </DashboardLayout>
  );
}
