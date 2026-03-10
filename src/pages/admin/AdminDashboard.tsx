import { useMemo, useState, FormEvent, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useModalOverlay } from "../../hooks/useModalOverlay";
import { Shield, Megaphone, Sparkles, Inbox, X, Filter, Pencil, Bell } from "lucide-react";
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
import { NotificationBuilders, createNotificationSilent } from "../../lib/pushNotifications";
import { DateField } from "../../components/forms/GlassyPickers";
import {
  useAnnouncementsQuery,
  useUpdateAnnouncement,
  type Announcement,
} from "../../hooks/queries/useAnnouncementsQuery";

// Storage key for persisting active tab
const ACTIVE_TAB_STORAGE_KEY = "atts:admin:dashboard:activeTab";

// Base tab configuration (counts added dynamically)
// Tab icons use inline width/height so size applies even if Tailwind is cached
const TAB_ICON_SIZE = 44;
const BASE_DASHBOARD_TABS = [
  { id: "control-panel", label: "Control Panel", shortLabel: "Control", icon: <img loading="lazy" src="/assets/control-panel.png" alt="" className="object-contain flex-shrink-0" style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, minWidth: TAB_ICON_SIZE, minHeight: TAB_ICON_SIZE }} /> },
  { id: "announcements", label: "Announcements", shortLabel: "News", icon: <img loading="lazy" src="/assets/news-announcements.png" alt="" className="object-contain flex-shrink-0" style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, minWidth: TAB_ICON_SIZE, minHeight: TAB_ICON_SIZE }} /> },
  { id: "requests", label: "Contact Requests", shortLabel: "Requests", icon: <img loading="lazy" src="/assets/contact-requests.png" alt="" className="object-contain flex-shrink-0" style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, minWidth: TAB_ICON_SIZE, minHeight: TAB_ICON_SIZE }} /> },
  { id: "notifications", label: "Push Notifications", shortLabel: "Push", icon: <img loading="lazy" src="/assets/push-notifications.png" alt="" className="object-contain flex-shrink-0" style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, minWidth: TAB_ICON_SIZE, minHeight: TAB_ICON_SIZE }} /> },
];

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
};

// Tab content animation variants
const tabContentVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    }
  },
  exit: { 
    opacity: 0, 
    y: -8,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1] as [number, number, number, number],
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
          className="relative w-full max-w-2xl rounded-3xl border border-[#f4c979]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-6 text-white shadow-[0_45px_80px_rgba(0,0,0,0.7)] space-y-4"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                id="contact-request-title"
                className="text-sm font-semibold tracking-[0.3em] uppercase text-[#f4c979]"
              >
                Contact message
              </p>
              <p className="text-2xl font-semibold text-white mt-1">{request.name}</p>
              <a
                href={`mailto:${request.email}`}
                className="text-sm text-[#f4c979] hover:text-white"
              >
                {request.email}
              </a>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:text-white hover:bg-white/10 transition"
              aria-label="Close full message"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-white/70 uppercase tracking-[0.3em]">
              <span>{CONTACT_TOPIC_LABELS[request.topic] ?? request.topic}</span>
              <span>{new Date(request.submitted_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed whitespace-pre-line">
              {request.message}
            </p>
          </div>
          <div className="flex justify-end">
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] px-5 py-2 text-sm font-semibold text-[#2e1b02] shadow-[0_10px_25px_rgba(244,201,121,0.3)] transition"
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

  // Announcement hooks
  const { data: announcements, isLoading: announcementsLoading } = useAnnouncementsQuery(10);
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
        // CREATE new announcement
        const { error } = await supabase.from("announcements").insert(payload);
        if (error) {
          logger.error("Failed to publish announcement:", error);
          setFeedback({
            type: "error",
            message: "Failed to publish announcement. Please try again.",
          });
          return;
        }

        // Send notification to all users (non-blocking)
        const notificationResult = await createNotificationSilent(
          NotificationBuilders.announcement({
            title: payload.title as string,
            message: payload.message as string,
          })
        );

        setFeedback({
          type: "success",
          message: notificationResult
            ? `Announcement published and sent to ${notificationResult.dispatched} users!`
            : "Announcement published successfully.",
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
  const renderControlPanelTab = () => (
    <motion.div
      key="control-panel"
      variants={tabContentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-4"
    >
      {/* Role dashboards — admin can navigate the entire app (compact row) */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="space-y-1.5"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#f8e5bb]/70 px-0.5">
          Navigate app
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {ADMIN_ROLE_DASHBOARDS_NAV_CARDS.map((card, index) => (
            <motion.div key={card.to} variants={itemVariants} custom={index}>
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

      <motion.div 
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {ADMIN_CORE_NAV_CARDS.map((card, index) => (
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

  // Announcements Tab Content
  const renderAnnouncementsTab = () => (
    <motion.div
      key="announcements"
      variants={tabContentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <section className="rounded-2xl sm:rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 shadow-[0_35px_60px_rgba(0,0,0,0.6)] relative overflow-hidden">
        {/* Ambient glow overlays */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,228,189,0.06),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(209,152,57,0.04),transparent_40%)]" />
        
        <div className="relative flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-[#fef3d1]/10 border border-[#f6dcb2]/40 rounded-full text-[0.6rem] sm:text-[0.65rem] font-semibold tracking-[0.2em] sm:tracking-[0.3em] uppercase text-[#f8dfb3] mb-2 sm:mb-4">
              {isEditMode ? (
                <Pencil className="w-3 h-3 sm:w-4 sm:h-4 text-[#f5cf82]" />
              ) : (
                <Megaphone className="w-3 h-3 sm:w-4 sm:h-4 text-[#f5cf82]" />
              )}
              {isEditMode ? "Edit" : "Publish"}
            </div>
            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white">
              {isEditMode ? "Edit Announcement" : "Create Announcement"}
            </h3>
            <p className="hidden sm:block text-sm text-[#f8e5bb]/80 mt-1">
              {isEditMode
                ? "Update the details below and save your changes."
                : "Publish news that appears instantly on the announcements page."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            disabled={composerOpen}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-transparent bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-[#332308] shadow-[0_15px_30px_rgba(0,0,0,0.45)] transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0b09] disabled:cursor-not-allowed disabled:opacity-60 min-h-[40px] sm:min-h-[44px]"
            aria-expanded={composerOpen ? "true" : "false"}
          >
            <span className="sm:hidden">+ New</span>
            <span className="hidden sm:inline">Create New Announcement</span>
          </button>
        </div>

        {composerOpen ? (
          <div className="relative space-y-3 sm:space-y-4">
            {feedback && (
              <div
                className={`rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm ${
                  feedback.type === "success"
                    ? "bg-[#1d1a14] text-[#f4d589] border border-[#f4d589]/50"
                    : "bg-[#2b1414] text-[#f2a4a4] border border-[#f47373]/40"
                }`}
              >
                {feedback.message}
              </div>
            )}

            <form
              aria-label={isEditMode ? "Edit announcement form" : "Create announcement form"}
              className={`space-y-3 sm:space-y-4 ${isEditMode ? "ring-2 ring-[#f4c979]/50 rounded-xl sm:rounded-2xl p-3 sm:p-4" : ""}`}
              onSubmit={handleCreateAnnouncement}
            >
              {isEditMode && editingAnnouncement && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-[#f4c979] pb-2 border-b border-[#f4c979]/20">
                  <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="truncate">Editing: <strong className="truncate">{editingAnnouncement.title}</strong></span>
                </div>
              )}
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-[#f3d9a4]/70 block mb-1.5 sm:mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. New safety protocols"
                    className="w-full bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 focus:ring-offset-2 focus:ring-offset-[#030201] min-h-[44px] sm:min-h-[48px]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-[#f3d9a4]/70 block mb-1.5 sm:mb-2">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share the details your team should know..."
                    rows={3}
                    className="w-full bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 focus:ring-offset-2 focus:ring-offset-[#030201] resize-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#f8e5bb]/80">
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
                      labelClassName="text-[0.65rem] uppercase tracking-[0.3em] text-[#f3d9a4]/70"
                      variant="gold"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1 sm:pt-2">
                <button
                  type="submit"
                  disabled={!isValid || submitting || (isEditMode && updateAnnouncement.isPending)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02] text-sm sm:text-base font-semibold transition hover:scale-[1.01] border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050301] disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] sm:min-h-[48px]"
                >
                  {submitting || (isEditMode && updateAnnouncement.isPending)
                    ? (isEditMode ? "Updating..." : "Publishing...")
                    : (isEditMode ? "Update" : "Publish")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComposerOpen(false);
                    if (isEditMode) resetToCreateMode();
                  }}
                  className="sm:w-auto inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-[#f4c979]/30 text-[#f4c979] text-sm sm:text-base font-semibold transition hover:bg-[#f4c979]/10 focus-visible:outline-none min-h-[44px] sm:min-h-[48px]"
                >
                  {isEditMode ? "Cancel" : "Hide"}
                </button>
              </div>
              {(submitting || (isEditMode && updateAnnouncement.isPending)) && (
                <div className="h-1 w-full rounded-full bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] animate-pulse" />
              )}
            </form>
          </div>
        ) : (
          <p className="relative text-xs sm:text-sm text-[#f8e5bb]/70 border-t border-white/5 pt-3 sm:pt-4">
            <span className="hidden sm:inline">Keep the dashboard tidy—open the composer only when you need to publish an update.</span>
            <span className="sm:hidden">Open composer to publish an update.</span>
          </p>
        )}

        {/* Recent Announcements List */}
        <div className="relative border-t border-white/5 pt-4 sm:pt-6 mt-1 sm:mt-2">
          <GoldCollapsibleSection
            id="recent-announcements"
            title="Recent Announcements"
            subtitle="Edit or manage past broadcasts"
            storageKey="recent-announcements-collapsed"
            defaultOpen={true}
            icon={<Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-[#f4c979]" />}
          >
            {announcementsLoading ? (
              <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 sm:h-16 rounded-lg sm:rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : !announcements || announcements.length === 0 ? (
              <p className="text-xs sm:text-sm text-[#f8e5bb]/70">No announcements yet.</p>
            ) : (
              <div className="space-y-1.5 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2 lg:grid-cols-3 lg:gap-3 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1 -mr-1 scrollbar-thin scrollbar-thumb-[#f4c979]/20 scrollbar-track-transparent">
                {announcements.map((announcement) => {
                  const isEditing = editingAnnouncement?.id === announcement.id;
                  // Format author - truncate email if too long
                  const authorDisplay = announcement.author.includes('@') 
                    ? announcement.author.split('@')[0] 
                    : announcement.author;
                  
                  return (
                    <motion.div
                      key={announcement.id}
                      className={`group relative rounded-lg sm:rounded-xl border transition-all ${
                        isEditing
                          ? "border-[#f4c979]/50 bg-[#f4c979]/10 ring-1 ring-[#f4c979]/30"
                          : "border-white/10 bg-black/30 hover:border-[#f4c979]/30 hover:bg-black/40"
                      }`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      {/* Compact layout */}
                      <div className="flex items-center p-2 sm:p-3 gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-white truncate leading-snug">
                            {announcement.title}
                          </p>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] md:text-xs text-[#f8e5bb]/60">
                            <span className="shrink-0">{announcement.date}</span>
                            <span className="text-[#f4c979]/40">·</span>
                            <span className="truncate">{authorDisplay}</span>
                          </div>
                        </div>
                        
                        {/* Edit button - compact */}
                        <button
                          type="button"
                          onClick={() => handleEditAnnouncement(announcement)}
                          className={`shrink-0 flex items-center justify-center rounded-lg border transition-all min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] p-1.5 sm:p-2 ${
                            isEditing
                              ? "border-[#f4c979]/50 bg-[#f4c979]/20 text-[#f4c979]"
                              : "border-[#f4c979]/30 text-[#f4c979] hover:bg-[#f4c979]/10 active:bg-[#f4c979]/20"
                          }`}
                          aria-label={`Edit announcement: ${announcement.title}`}
                        >
                          <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                      
                      {/* Editing indicator */}
                      {isEditing && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#f4c979] shadow-[0_0_8px_rgba(244,201,121,0.8)]">
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
      <section className="rounded-2xl sm:rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 shadow-[0_35px_60px_rgba(0,0,0,0.6)] relative overflow-hidden">
        {/* Ambient glow overlays */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,228,189,0.06),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(209,152,57,0.04),transparent_40%)]" />
        
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-[#fef3d1]/10 border border-[#f6dcb2]/40 rounded-full text-[0.6rem] sm:text-[0.65rem] font-semibold tracking-[0.2em] sm:tracking-[0.3em] uppercase text-[#f8dfb3] mb-2 sm:mb-4">
              <Inbox className="w-3 h-3 sm:w-4 sm:h-4 text-[#f5cf82]" />
              <span className="hidden sm:inline">Contact Inbox</span>
              <span className="sm:hidden">Inbox</span>
            </div>
            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white">
              <span className="hidden sm:inline">Latest Contact Requests</span>
              <span className="sm:hidden">Contact Requests</span>
            </h3>
            <p className="hidden sm:block text-sm text-[#f8e5bb]/70 mt-1">
              Messages submitted through the Contact page are routed here for admin follow-up.
            </p>
          </div>
          <span className="text-[10px] sm:text-xs text-[#f8e5bb]/60 whitespace-nowrap px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/5 border border-white/10 self-start">
            {contactRequests.length} · live
          </span>
        </div>

        {contactRequests.length > 0 && (
          <div className="relative flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/5 bg-white/5 p-2 sm:p-3">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-[#f4c979]">
              <Filter className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Filter topics</span>
              <span className="sm:hidden">Filter</span>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {["all", "general", "hr", "safety", "payroll"].map((topic) => (
                <motion.button
                  key={topic}
                  type="button"
                  onClick={() => setContactTopicFilter(topic)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold transition-all duration-200 ${
                    contactTopicFilter === topic
                      ? "bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02] shadow-[0_5px_20px_rgba(244,201,121,0.35)]"
                      : "border border-white/10 text-[#f8e5bb]/80 hover:text-white hover:border-[#f4c979]/40 hover:bg-white/5"
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
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                whileHover={{ scale: 1.05 }}
                className="text-[10px] sm:text-xs font-semibold text-[#f8e5bb]/70 hover:text-white transition-colors inline-flex items-center gap-1"
              >
                <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                Reset
              </motion.button>
            )}
          </div>
        )}

        {contactError && (
          <div className="rounded-xl sm:rounded-2xl border border-[#f47373]/40 bg-[#2b1414]/70 text-[#f2a4a4] px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">
            {contactError}
          </div>
        )}

        {contactLoading ? (
          <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl sm:rounded-2xl border border-white/5 bg-white/5 h-24 sm:h-32 animate-pulse"
              />
            ))}
          </div>
        ) : filteredContactRequests.length === 0 ? (
          <p className="text-xs sm:text-sm text-[#f8e5bb]/70">
            {contactRequests.length === 0
              ? "No contact requests yet."
              : "No requests match this filter."}
          </p>
        ) : (
          <div className="grid gap-2 sm:gap-3 md:gap-4 sm:grid-cols-2">
            {filteredContactRequests.map((request, index) => (
              <motion.article
                key={request.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="rounded-xl sm:rounded-2xl border border-white/10 bg-black/30 p-2.5 sm:p-4 text-white/85 space-y-2 sm:space-y-3 transition-all duration-300 hover:border-[#f4c979]/30 hover:bg-black/40 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-white truncate">{request.name}</p>
                    <a
                      href={`mailto:${request.email}`}
                      className="text-[10px] sm:text-xs text-[#f4c979] hover:text-[#ffe6bc] transition-colors truncate block"
                    >
                      {request.email}
                    </a>
                  </div>
                  <span className="text-[8px] sm:text-[0.65rem] uppercase tracking-[0.15em] sm:tracking-[0.25em] px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-[#f6dcb2]/30 text-[#f8e5bb]/80 transition-colors hover:border-[#f4c979]/50 shrink-0">
                    {CONTACT_TOPIC_LABELS[request.topic] ?? request.topic}
                  </span>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <p className="text-xs sm:text-sm text-white/80 leading-relaxed line-clamp-2 sm:line-clamp-3">
                    {request.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => setExpandedRequest(request)}
                    className="text-[10px] sm:text-xs font-semibold tracking-wide text-[#f4c979] hover:text-white transition-colors inline-flex items-center gap-1 group"
                  >
                    View full
                    <span className="transform transition-transform group-hover:translate-x-1">→</span>
                  </button>
                </div>
                <p className="text-[9px] sm:text-xs text-[#f8e5bb]/60">
                  {new Date(request.submitted_at).toLocaleString()}
                </p>
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
      className="space-y-4 sm:space-y-6"
    >
      <section className="rounded-2xl sm:rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-5 shadow-[0_35px_60px_rgba(0,0,0,0.6)] relative overflow-hidden">
        {/* Ambient glow overlays */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,228,189,0.06),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(209,152,57,0.04),transparent_40%)]" />
        
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-[#fef3d1]/10 border border-[#f6dcb2]/40 rounded-full text-[0.6rem] sm:text-[0.65rem] font-semibold tracking-[0.2em] sm:tracking-[0.3em] uppercase text-[#f8dfb3] mb-2 sm:mb-4">
            <Bell className="w-3 h-3 sm:w-4 sm:h-4 text-[#f5cf82]" />
            <span className="hidden sm:inline">Manual Push Notifications</span>
            <span className="sm:hidden">Push</span>
          </div>
          <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white">
            Send Push Notification
          </h3>
          <p className="hidden sm:block text-sm text-[#f8e5bb]/70 mt-1">
            Broadcast important messages directly to users' devices. Target all users, specific roles, or job crews.
          </p>
        </div>
        
        <div className="relative border-t border-white/5 pt-3 sm:pt-6">
          <AdminManualNotifications />
        </div>
      </section>
      
      {/* Enable Notifications Button */}
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
    <DashboardLayout title="Admin Panel">
      <>
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 pb-4 pt-2 sm:pt-4 md:pt-6">
          {/* Premium Animated Welcome Section with Glass Backdrop - Gold Theme */}
          <div className="mb-3 sm:mb-5 md:mb-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Glass backdrop container - Gold theme */}
              <div 
                className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
                style={{
                  background: 'linear-gradient(145deg, rgba(244, 201, 121, 0.1) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)',
                  backdropFilter: 'blur(24px) saturate(1.6)',
                  WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
                }}
              >
                {/* Realistic glass gloss - diagonal shine reflection */}
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 25%, transparent 50%, transparent 100%)',
                  }}
                />
                
                {/* Secondary gloss layer */}
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%)',
                  }}
                />
                
                {/* Inner gold glow */}
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at 25% 0%, rgba(244, 201, 121, 0.2) 0%, transparent 45%)',
                  }}
                />
                
                {/* Specular highlight - corner gleam */}
                <div 
                  className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0%, transparent 50%)',
                  }}
                />
                
                {/* Top edge highlight */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5 rounded-t-[inherit]" />
                
                {/* Left edge highlight */}
                <div className="absolute top-0 left-0 bottom-0 w-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-l-[inherit]" />

                {/* Content area */}
                <div className="relative px-3 py-3 sm:px-5 sm:py-4 md:px-7 md:py-5">
                  {/* Eyebrow with role badge */}
                  <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30"
                      >
                        <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#f4c979]" />
                        <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-bold text-[#f8e5bb]">
                          <span className="hidden sm:inline">Admin Control Room</span>
                          <span className="sm:hidden">Admin</span>
                        </span>
                      </motion.div>
                      
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                        className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 rounded-lg bg-[#1c1c1f]/60 border border-[#f4c979]/20"
                      >
                        <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#f4c979]" />
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-semibold text-[#f8e5bb]/70">
                          {role || "Admin"}
                        </span>
                      </motion.div>
                    </div>
                    
                    {/* Avatar dropdown portal */}
                    <AvatarDropdownPortal
                      email={session?.user?.email}
                      role={role}
                      fullName={displayName}
                      avatarUrl={avatarUrl}
                      theme="gold"
                      onSignOut={handleSignOut}
                    />
                  </div>

                  <div className="flex items-center gap-2.5 sm:gap-4">
                    {/* Gradient line accent - Gold */}
                    <motion.div
                      initial={{ scaleY: 0, opacity: 0 }}
                      animate={{ scaleY: 1, opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="w-0.5 sm:w-1 h-10 sm:h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0"
                      style={{
                        boxShadow: '0 0 20px rgba(244, 201, 121, 0.5), 0 0 40px rgba(244, 201, 121, 0.25)',
                      }}
                    />
                    
                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                      {enableAnimations ? (
                        <TextEffect
                          as="h1"
                          preset="blurSlide"
                          per="char"
                          delay={0.15}
                          className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight"
                          segmentWrapperClassName="bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(244,201,121,0.35)]"
                        >
                          {`Welcome back, ${displayName}`}
                        </TextEffect>
                      ) : (
                        <h1 
                          className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent"
                        >
                          {`Welcome back, ${displayName}`}
                        </h1>
                      )}
                      
                      {/* Description - hidden on mobile */}
                      <motion.p
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.7, ease: 'easeOut' }}
                        className="hidden sm:block mt-1.5 md:mt-2 text-xs sm:text-sm text-[#f8e5bb]/50 font-medium leading-relaxed max-w-xl"
                      >
                        Manage users, broadcast announcements, and track mission-critical tools
                      </motion.p>
                    </div>
                  </div>

                  {/* Segmented Control - Embedded in Header */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-3 sm:mt-5 md:mt-6"
                  >
                    <AdminSegmentedControl
                      tabs={DASHBOARD_TABS}
                      activeTab={activeTab}
                      onChange={handleTabChange}
                    />
                  </motion.div>
                </div>
                
                {/* Bottom edge shadow */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
                
                {/* Right edge shadow */}
                <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
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
