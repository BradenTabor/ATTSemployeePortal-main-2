import { useMemo, useState, FormEvent, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useModalOverlay } from "../../hooks/useModalOverlay";
import { Shield, Megaphone, Inbox, X, Filter, Pencil, Bell, ChevronDown, Radio } from "lucide-react";
import IncidentLoggingModal from "../../components/admin/IncidentLoggingModal";
import SafetyIncidentsList from "../../components/admin/SafetyIncidentsList";
import DashboardLayout from "../../layouts/DashboardLayout";
import { ADMIN_CORE_NAV_CARDS, ADMIN_ROLE_DASHBOARDS_NAV_CARDS } from "../../components/admin/adminNavConfig";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { AdminManualNotifications } from "../../components/admin/AdminManualNotifications";
import { EnableNotificationsButton } from "../../components/notifications";
import BrandedNavCard from "../../components/BrandedNavCard";
import { AvatarDropdownPortal } from "../../components/dashboard/AvatarDropdownPortal";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { subscribeToTableChanges } from "../../lib/realtime";
import { logger } from "../../lib/logger";
import { DateField } from "../../components/forms/GlassyPickers";
import { glass, canopy } from "../../lib/glass";
import AdminKpiBand from "../../components/dashboard/AdminKpiBand";
import AdminQuickAccess from "../../components/dashboard/AdminQuickAccess";
import { Eyebrow } from "../../components/canopy/Eyebrow";
import { SectionRail } from "../../components/canopy/SectionRail";
import { useActiveSection } from "../../components/canopy/useActiveSection";
import { TiltCard } from "../../components/canopy/TiltCard";
import {
  EASE_CANOPY,
  riseThroughBlur,
  unfurlContainer,
  staggerItem,
  reducedMotionFade,
  scrollFadeUp,
  tweenMedium,
} from "../../motion/presets";

/** Entrance for control-panel cards revealed by "+N more" (staggered via `custom` index). */
const revealedNavCard: Variants = {
  hidden: staggerItem.hidden,
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { ...tweenMedium, delay: i * 0.06 },
  }),
  exit: staggerItem.exit,
};
import {
  useAnnouncementsQuery,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  type Announcement,
} from "../../hooks/queries/useAnnouncementsQuery";

// ---------------------------------------------------------------------------
// Sections of the Command Canopy (one scroll, one rail)
// ---------------------------------------------------------------------------
const SECTION_IDS = {
  glance: "cc-glance",
  quick: "cc-quick",
  navigate: "cc-navigate",
  control: "cc-control",
  broadcast: "cc-broadcast",
  inbox: "cc-inbox",
  push: "cc-push",
  incidents: "cc-incidents",
} as const;

const RAIL_IDS = [
  SECTION_IDS.glance,
  SECTION_IDS.quick,
  SECTION_IDS.navigate,
  SECTION_IDS.control,
  SECTION_IDS.broadcast,
  SECTION_IDS.inbox,
  SECTION_IDS.push,
  SECTION_IDS.incidents,
];

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

const FIELD =
  "w-full rounded-leaf-xs border border-bone-50/[0.12] bg-ink-950/80 px-3.5 py-3 text-sm text-bone-50 placeholder:text-ink-400 " +
  "outline-none transition-[border-color,box-shadow] duration-300 ease-canopy focus:border-verdant-400/70 focus:shadow-glow min-h-[44px]";

function ContactRequestModalContent({ request, onClose }: { request: ContactRequest; onClose: () => void }) {
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
        <motion.div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-request-title"
          className={`${glass.elevated} relative w-full max-w-lg space-y-4 p-6 text-bone-100`}
          initial={{ opacity: 0, scale: 0.96, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.5, ease: EASE_CANOPY }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p id="contact-request-title" className="type-instrument text-verdant-300">
                Contact message
              </p>
              <p className="type-display mt-1 text-2xl text-bone-50">{request.name}</p>
              <a href={`mailto:${request.email}`} className="text-xs text-bone-300 transition-colors hover:text-verdant-300">
                {request.email}
              </a>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-leaf-xs border border-bone-50/[0.1] bg-bone-50/[0.04] p-2 text-bone-300 transition hover:bg-bone-50/[0.08] hover:text-bone-50"
              aria-label="Close full message"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className={`${glass.subtle} space-y-2.5 p-4`}>
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
              <span>{CONTACT_TOPIC_LABELS[request.topic] ?? request.topic}</span>
              <span>{new Date(request.submitted_at).toLocaleString()}</span>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-bone-200">{request.message}</p>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={`${canopy.buttonPrimary} px-5 py-2.5 text-sm`}>
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SectionShell({
  id,
  index,
  label,
  action,
  children,
  reduce,
}: {
  id: string;
  index: number;
  label: string;
  action?: ReactNode;
  children: ReactNode;
  reduce: boolean;
}) {
  return (
    <motion.section
      id={id}
      className="scroll-mt-6 space-y-4"
      aria-label={label}
      variants={reduce ? reducedMotionFade : scrollFadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.05 }}
    >
      <div className="flex items-center gap-3">
        <Eyebrow index={index} tone="bone" className="flex-1">
          {label}
        </Eyebrow>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { session, role, signOut, setSession, avatarUrl, fullName } = useAuth();
  const isAdmin = role === "admin";

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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Contact requests state
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState<string | null>(null);
  const [expandedRequest, setExpandedRequest] = useState<ContactRequest | null>(null);
  const [contactTopicFilter, setContactTopicFilter] = useState<string>("all");

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showAllNavCards, setShowAllNavCards] = useState(false);
  const VISIBLE_NAV_CARD_COUNT = 6;

  const { data: announcements, isLoading: announcementsLoading } = useAnnouncementsQuery(10);
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();

  const caps = useMemo(() => getDeviceCapabilities(), []);
  const reduce = caps.prefersReducedMotion || caps.isLowEnd;

  const displayName = useMemo(
    () => fullName?.split(" ")[0] || session?.user?.email?.split("@")[0] || "Admin",
    [fullName, session?.user?.email]
  );

  const [activeSection, jumpTo] = useActiveSection(RAIL_IDS);

  const railSections = useMemo(
    () => [
      { id: SECTION_IDS.glance, label: "At a glance" },
      { id: SECTION_IDS.quick, label: "Quick access" },
      { id: SECTION_IDS.navigate, label: "Navigate" },
      { id: SECTION_IDS.control, label: "Control panel" },
      { id: SECTION_IDS.broadcast, label: "Broadcast" },
      { id: SECTION_IDS.inbox, label: "Inbox", count: contactRequests.length },
      { id: SECTION_IDS.push, label: "Push" },
      { id: SECTION_IDS.incidents, label: "Incidents" },
    ],
    [contactRequests.length]
  );

  // Fetch contact requests + realtime
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
        if (isMounted) setContactLoading(false);
      }
    };

    fetchContactRequests();

    const unsubscribe = subscribeToTableChanges({
      channelName: "admin-contact-requests",
      table: "contact_requests",
      onInsert: () => isMounted && fetchContactRequests(),
      onUpdate: () => isMounted && fetchContactRequests(),
      onDelete: () => isMounted && fetchContactRequests(),
      onError: (err) => logger.error("Contact requests realtime error:", err),
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isAdmin]);

  const isValid = title.trim().length > 0 && message.trim().length > 0;

  const resetToCreateMode = () => {
    setIsEditMode(false);
    setEditingAnnouncement(null);
    setTitle("");
    setMessage("");
    setScheduleLater(false);
    setPublishDate("");
    setFeedback(null);
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setComposerOpen(true);
    setIsEditMode(true);
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setMessage(announcement.message);
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
      date: scheduleLater && publishDate ? publishDate : new Date().toISOString().slice(0, 10),
    };

    try {
      setSubmitting(true);
      setFeedback(null);

      if (isEditMode && editingAnnouncement) {
        await updateAnnouncement.mutateAsync({ id: editingAnnouncement.id, ...payload });
        setFeedback({ type: "success", message: "Announcement updated successfully." });
        resetToCreateMode();
      } else {
        await createAnnouncement.mutateAsync(payload);
        setFeedback({ type: "success", message: "Announcement published successfully." });
        setTitle("");
        setMessage("");
        setScheduleLater(false);
        setPublishDate("");
      }
    } catch (err) {
      logger.error("Failed to save announcement:", err);
      setFeedback({ type: "error", message: "Something went wrong. Please try again shortly." });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredContactRequests = useMemo(() => {
    if (contactTopicFilter === "all") return contactRequests;
    return contactRequests.filter((request) => request.topic === contactTopicFilter);
  }, [contactRequests, contactTopicFilter]);

  const visibleCards = showAllNavCards ? ADMIN_CORE_NAV_CARDS : ADMIN_CORE_NAV_CARDS.slice(0, VISIBLE_NAV_CARD_COUNT);
  const hiddenCount = ADMIN_CORE_NAV_CARDS.length - VISIBLE_NAV_CARD_COUNT;
  const isSaving = submitting || (isEditMode && updateAnnouncement.isPending);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-rose-400" aria-hidden />
          <h2 className="type-display mb-2 text-3xl text-bone-50">Access Denied</h2>
          <p className="text-bone-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const headline = `Welcome back, ${displayName}`;
  const headlineWords = headline.split(" ");

  return (
    <DashboardLayout title="Admin Panel" pageHeading>
      <>
        <div className="relative mx-auto w-full max-w-[1400px] pb-6">
          <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
            {/* Section rail */}
            <aside className="sticky top-0 z-20 -mx-4 mb-4 bg-ink-950/60 px-4 py-2 backdrop-blur-md lg:static lg:mx-0 lg:mb-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
              <div className="lg:sticky lg:top-2">
                <p className="type-instrument mb-3 hidden text-bone-50/40 lg:block">Command Canopy</p>
                <SectionRail sections={railSections} active={activeSection} onJump={jumpTo} />
              </div>
            </aside>

            <div className="space-y-12 md:space-y-16">
              {/* ------------------------------------------------------------ */}
              {/* 01 · Hero + At a glance                                        */}
              {/* ------------------------------------------------------------ */}
              <section id={SECTION_IDS.glance} className="scroll-mt-6" aria-label="At a glance">
                <motion.div
                  className={`${canopy.hero} p-6 sm:p-8 lg:p-10`}
                  initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(12px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 1, ease: EASE_CANOPY }}
                >
                  {/* seed orb — 3D hero object */}
                  {!caps.isLowEnd && !caps.isMobile && (
                    <motion.img
                      src="/assets/canopy/orb.webp"
                      alt=""
                      aria-hidden
                      width={1024}
                      height={1024}
                      decoding="async"
                      className={`pointer-events-none absolute -right-24 -top-24 hidden w-[420px] select-none mix-blend-screen md:block lg:-right-16 lg:-top-28 lg:w-[500px] ${reduce ? "" : "animate-drift"}`}
                      style={{
                        maskImage: "radial-gradient(50% 50% at 50% 50%, black 45%, transparent 100%)",
                        WebkitMaskImage: "radial-gradient(50% 50% at 50% 50%, black 45%, transparent 100%)",
                      }}
                      initial={reduce ? false : { opacity: 0, scale: 0.85, rotate: 8 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ duration: 1.8, ease: EASE_CANOPY, delay: 0.2 }}
                    />
                  )}

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Eyebrow tone="verdant" rule={false}>
                        <span className="inline-flex items-center gap-2">
                          <Radio className="h-3 w-3 animate-pulse" aria-hidden />
                          Command Canopy · {role}
                        </span>
                      </Eyebrow>

                      <h1 className="type-display mt-5 max-w-3xl text-balance text-[clamp(2.25rem,6vw,4.75rem)] font-light text-bone-50">
                        {headlineWords.map((w, i) => (
                          <motion.span
                            key={`${w}-${i}`}
                            className={`inline-block ${i === headlineWords.length - 1 ? "italic text-verdant-300 text-glow" : ""}`}
                            variants={reduce ? reducedMotionFade : riseThroughBlur}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: reduce ? 0 : 0.2 + i * 0.08 }}
                          >
                            {w}
                            {i < headlineWords.length - 1 && "\u00A0"}
                          </motion.span>
                        ))}
                      </h1>

                      <motion.p
                        className="mt-4 max-w-xl text-pretty text-base text-bone-300 sm:text-lg"
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: EASE_CANOPY, delay: 0.55 }}
                      >
                        Every instrument of the operation on one surface — people, broadcasts, requests and safety.
                      </motion.p>
                    </div>

                    <div className="relative z-10 shrink-0">
                      <AvatarDropdownPortal
                        email={session?.user?.email}
                        role={role}
                        fullName={displayName}
                        avatarUrl={avatarUrl}
                        theme="gold"
                        onSignOut={handleSignOut}
                      />
                    </div>
                  </div>

                  <div className="relative mt-8">
                    <AdminKpiBand pendingRequests={contactRequests.length} onShowRequests={() => jumpTo(SECTION_IDS.inbox)} />
                  </div>
                </motion.div>
              </section>

              {/* 02 · Quick access */}
              <SectionShell id={SECTION_IDS.quick} index={2} label="Quick access" reduce={reduce}>
                <AdminQuickAccess />
              </SectionShell>

              {/* 03 · Navigate */}
              <SectionShell id={SECTION_IDS.navigate} index={3} label="Navigate the app" reduce={reduce}>
                <motion.div
                  className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden"
                  variants={reduce ? reducedMotionFade : unfurlContainer}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                >
                  {ADMIN_ROLE_DASHBOARDS_NAV_CARDS.map((card) => (
                    <motion.div key={card.to} variants={reduce ? reducedMotionFade : staggerItem} className="w-[68%] flex-none snap-center sm:w-auto">
                      <BrandedNavCard
                        title={card.title.replace(/ Dashboard$/, "")}
                        description={card.description}
                        icon={card.icon}
                        to={card.to}
                        variant={card.variant ?? "gold"}
                        compact
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </SectionShell>

              {/* 04 · Control panel */}
              <SectionShell
                id={SECTION_IDS.control}
                index={4}
                label="Control panel"
                reduce={reduce}
                action={
                  hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllNavCards((p) => !p)}
                      className="tap-44 relative inline-flex items-center gap-1.5 rounded-full border border-bone-50/[0.12] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-bone-300 transition-colors hover:border-verdant-400/50 hover:text-verdant-200"
                    >
                      {showAllNavCards ? "Show less" : `+${hiddenCount} more`}
                      <motion.span animate={{ rotate: showAllNavCards ? 180 : 0 }} transition={{ duration: 0.4, ease: EASE_CANOPY }}>
                        <ChevronDown className="h-3 w-3" aria-hidden />
                      </motion.span>
                    </button>
                  )
                }
              >
                <motion.div
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  variants={reduce ? reducedMotionFade : unfurlContainer}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.1 }}
                >
                  <AnimatePresence initial={false}>
                    {visibleCards.map((card, index) => {
                      // Cards revealed via "+N more" mount after the container's
                      // whileInView (once) has fired, so the "visible" variant never
                      // propagates to them. Drive their entrance explicitly.
                      const revealedLater = index >= VISIBLE_NAV_CARD_COUNT;
                      return (
                        <motion.div
                          key={card.to}
                          variants={reduce ? reducedMotionFade : revealedLater ? revealedNavCard : staggerItem}
                          {...(revealedLater
                            ? { initial: "hidden", animate: "visible", custom: index - VISIBLE_NAV_CARD_COUNT }
                            : {})}
                          layout
                          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                        >
                          <TiltCard max={5} className="h-full rounded-leaf">
                            <BrandedNavCard title={card.title} description={card.description} icon={card.icon} to={card.to} variant={card.variant ?? "gold"} />
                          </TiltCard>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              </SectionShell>

              {/* 05 · Broadcast */}
              <SectionShell
                id={SECTION_IDS.broadcast}
                index={5}
                label="Broadcast"
                reduce={reduce}
                action={
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    disabled={composerOpen}
                    aria-expanded={composerOpen}
                    className={`${canopy.buttonPrimary} px-4 py-2 text-xs`}
                  >
                    <Megaphone className="h-3.5 w-3.5" aria-hidden />
                    <span className="sm:hidden">New</span>
                    <span className="hidden sm:inline">New announcement</span>
                  </button>
                }
              >
                <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  {/* Composer */}
                  <div className={`${glass.cardGold} relative self-start p-5 sm:p-6`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="type-instrument text-verdant-300">{isEditMode ? "Edit" : "Publish"}</p>
                        <h3 className="type-display mt-1 text-2xl text-bone-50 sm:text-3xl">{isEditMode ? "Edit announcement" : "Create announcement"}</h3>
                        <p className="mt-2 max-w-md text-sm text-bone-300">
                          {isEditMode ? "Update the details below and save your changes." : "Publish news that appears instantly on the announcements page."}
                        </p>
                      </div>
                    </div>

                    <AnimatePresence initial={false} mode="wait">
                      {composerOpen ? (
                        <motion.div
                          key="composer"
                          initial={reduce ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.5, ease: EASE_CANOPY }}
                          className="overflow-hidden"
                        >
                          <div className="mt-5 space-y-4">
                            {feedback && (
                              <div
                                role={feedback.type === "error" ? "alert" : "status"}
                                className={`rounded-leaf-xs border px-3.5 py-2.5 text-sm ${
                                  feedback.type === "success"
                                    ? "border-verdant-500/30 bg-verdant-500/10 text-verdant-100"
                                    : "border-rose-500/30 bg-rose-500/10 text-rose-100"
                                }`}
                              >
                                {feedback.message}
                              </div>
                            )}

                            <form aria-label={isEditMode ? "Edit announcement form" : "Create announcement form"} className="space-y-4" onSubmit={handleCreateAnnouncement}>
                              {isEditMode && editingAnnouncement && (
                                <div className="flex items-center gap-2 border-b border-bone-50/[0.08] pb-2 font-mono text-[11px] text-verdant-300">
                                  <Pencil className="h-3 w-3" aria-hidden />
                                  <span className="truncate">
                                    Editing: <strong className="text-bone-50">{editingAnnouncement.title}</strong>
                                  </span>
                                </div>
                              )}
                              <div className="space-y-2">
                                <label htmlFor="ann-title" className="type-instrument block text-bone-300">
                                  Title
                                </label>
                                <input id="ann-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New safety protocols" className={FIELD} />
                              </div>
                              <div className="space-y-2">
                                <label htmlFor="ann-message" className="type-instrument block text-bone-300">
                                  Message
                                </label>
                                <textarea
                                  id="ann-message"
                                  value={message}
                                  onChange={(e) => setMessage(e.target.value)}
                                  placeholder="Share the details your team should know..."
                                  rows={4}
                                  className={`${FIELD} resize-none`}
                                />
                              </div>

                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <label className="inline-flex items-center gap-2 text-xs text-bone-300">
                                  <input type="checkbox" checked={scheduleLater} onChange={(e) => setScheduleLater(e.target.checked)} className="h-4 w-4 accent-verdant-400" />
                                  Schedule publish date
                                </label>
                                {scheduleLater && (
                                  <div className="max-w-xs flex-1">
                                    <DateField
                                      label="Publish Date"
                                      value={publishDate}
                                      onChange={(e) => setPublishDate(e.target.value)}
                                      helperText="Goes live at 12:01 AM"
                                      containerClassName="text-bone-50"
                                      labelClassName="type-instrument text-bone-300"
                                      variant="gold"
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button type="submit" disabled={!isValid || isSaving} className={`${canopy.buttonPrimary} flex-1 text-sm`}>
                                  {isSaving ? (isEditMode ? "Updating..." : "Publishing...") : isEditMode ? "Update" : "Publish"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setComposerOpen(false);
                                    if (isEditMode) resetToCreateMode();
                                  }}
                                  className={`${canopy.buttonGhost} text-sm`}
                                >
                                  {isEditMode ? "Cancel" : "Hide"}
                                </button>
                              </div>
                              {isSaving && <div className="vein" />}
                            </form>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.p key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 border-t border-bone-50/[0.08] pt-4 text-xs text-bone-400">
                          Open the composer to publish an update.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Recent */}
                  <div className={`${glass.card} flex flex-col p-5 sm:p-6`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="type-instrument text-bone-300">Recent</p>
                        <h3 className="type-display mt-1 text-2xl text-bone-50">Broadcast log</h3>
                      </div>
                      <Megaphone className="h-4 w-4 text-verdant-300" aria-hidden />
                    </div>
                    <div className="mt-4 flex-1">
                      {announcementsLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-14 animate-pulse rounded-leaf-xs bg-bone-50/5" />
                          ))}
                        </div>
                      ) : !announcements || announcements.length === 0 ? (
                        <p className="text-xs text-bone-400">No announcements yet.</p>
                      ) : (
                        <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                          {announcements.map((announcement, i) => {
                            const isEditing = editingAnnouncement?.id === announcement.id;
                            const authorDisplay = announcement.author.includes("@") ? announcement.author.split("@")[0] : announcement.author;
                            return (
                              <li
                                key={announcement.id}
                                className={`group relative flex items-center gap-3 rounded-leaf-xs border px-3 py-2.5 transition-colors duration-300 ${
                                  isEditing ? "border-verdant-400/50 bg-verdant-500/10" : "border-bone-50/[0.06] bg-ink-950/50 hover:border-verdant-400/30"
                                }`}
                              >
                                <span className="type-instrument w-5 text-bone-50/30">{String(i + 1).padStart(2, "0")}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-bone-50">{announcement.title}</p>
                                  <p className="mt-0.5 truncate font-mono text-[10px] text-bone-400">
                                    {announcement.date} · {authorDisplay}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleEditAnnouncement(announcement)}
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-leaf-xs border transition-colors ${
                                    isEditing ? "border-verdant-400/50 bg-verdant-500/20 text-verdant-200" : "border-bone-50/[0.1] text-bone-300 hover:border-verdant-400/40 hover:text-verdant-200"
                                  }`}
                                  aria-label={`Edit announcement: ${announcement.title}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </SectionShell>

              {/* 06 · Inbox */}
              <SectionShell
                id={SECTION_IDS.inbox}
                index={6}
                label="Inbox"
                reduce={reduce}
                action={
                  <span className={canopy.pillLive}>
                    <span className="h-1.5 w-1.5 rounded-full bg-verdant-400 animate-pulse" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em]">{contactRequests.length} live</span>
                  </span>
                }
              >
                <div className={`${glass.cardGold} space-y-4 p-5 sm:p-6`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="type-instrument text-verdant-300">Contact requests</p>
                      <h3 className="type-display mt-1 text-2xl text-bone-50 sm:text-3xl">Messages from the field</h3>
                      <p className="mt-2 max-w-lg text-sm text-bone-300">Routed here from the Contact page for follow-up.</p>
                    </div>
                    <Inbox className="hidden h-5 w-5 text-verdant-300 sm:block" aria-hidden />
                  </div>

                  {contactRequests.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <Filter className="h-3 w-3 shrink-0 text-bone-400" aria-hidden />
                      <div className="flex gap-1.5">
                        {["all", "general", "hr", "safety", "payroll"].map((topic) => {
                          const active = contactTopicFilter === topic;
                          return (
                            <button
                              key={topic}
                              type="button"
                              onClick={() => setContactTopicFilter(topic)}
                              aria-pressed={active}
                              className={`tap-44 relative whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors duration-300 ${
                                active ? "border-verdant-400 bg-verdant-400 text-ink-950" : "border-bone-50/[0.12] text-bone-300 hover:border-verdant-400/40 hover:text-bone-50"
                              }`}
                            >
                              {topic === "all" ? "All" : CONTACT_TOPIC_LABELS[topic] ?? topic}
                            </button>
                          );
                        })}
                      </div>
                      {contactTopicFilter !== "all" && (
                        <button type="button" onClick={() => setContactTopicFilter("all")} className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-bone-400 hover:text-bone-50">
                          <X className="h-3 w-3" aria-hidden />
                          Reset
                        </button>
                      )}
                    </div>
                  )}

                  {contactError && (
                    <div role="alert" className="rounded-leaf-xs border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-100">
                      {contactError}
                    </div>
                  )}

                  {contactLoading ? (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 animate-pulse rounded-leaf-sm bg-bone-50/5" />
                      ))}
                    </div>
                  ) : filteredContactRequests.length === 0 ? (
                    <p className="py-2 text-sm text-bone-400">{contactRequests.length === 0 ? "No contact requests yet." : "No requests match this filter."}</p>
                  ) : (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {filteredContactRequests.map((request, index) => (
                        <motion.article
                          key={request.id}
                          initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(4px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          transition={{ duration: 0.6, ease: EASE_CANOPY, delay: index * 0.05 }}
                          whileTap={{ scale: 0.985 }}
                          onClick={() => setExpandedRequest(request)}
                          className="group cursor-pointer space-y-2 rounded-leaf-sm border border-bone-50/[0.08] bg-ink-950/50 p-4 transition-colors duration-300 hover:border-verdant-400/40 hover:bg-ink-900/70"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-bone-50">{request.name}</p>
                              <a href={`mailto:${request.email}`} onClick={(e) => e.stopPropagation()} className="block truncate text-[11px] text-bone-400 transition-colors hover:text-verdant-300">
                                {request.email}
                              </a>
                            </div>
                            <span className="shrink-0 rounded-full border border-bone-50/[0.12] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-bone-300">
                              {CONTACT_TOPIC_LABELS[request.topic] ?? request.topic}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-xs leading-relaxed text-bone-300">{request.message}</p>
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="text-bone-400">{new Date(request.submitted_at).toLocaleString()}</span>
                            <span className="text-verdant-300 opacity-70 transition-opacity group-hover:opacity-100">Open ↗</span>
                          </div>
                        </motion.article>
                      ))}
                    </div>
                  )}
                </div>
              </SectionShell>

              {/* 07 · Push */}
              <SectionShell id={SECTION_IDS.push} index={7} label="Push notifications" reduce={reduce}>
                <div className={`${glass.cardGold} space-y-5 p-5 sm:p-6`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="type-instrument text-verdant-300">Push</p>
                      <h3 className="type-display mt-1 text-2xl text-bone-50 sm:text-3xl">Send a push notification</h3>
                      <p className="mt-2 max-w-lg text-sm text-bone-300">Broadcast directly to users' devices. Target everyone, specific roles, or job crews.</p>
                    </div>
                    <Bell className="hidden h-5 w-5 text-verdant-300 sm:block" aria-hidden />
                  </div>
                  <div className="border-t border-bone-50/[0.08] pt-5">
                    <AdminManualNotifications />
                  </div>
                </div>
                <div className="flex justify-center">
                  <EnableNotificationsButton variant="gold" />
                </div>
              </SectionShell>

              {/* 08 · Incidents */}
              <SectionShell id={SECTION_IDS.incidents} index={8} label="Safety incidents" reduce={reduce}>
                <SafetyIncidentsList onLogIncident={() => setShowIncidentModal(true)} />
              </SectionShell>
            </div>
          </div>
        </div>

        {createPortal(<IncidentLoggingModal isOpen={showIncidentModal} onClose={() => setShowIncidentModal(false)} />, document.body)}

        {expandedRequest && createPortal(<ContactRequestModalContent request={expandedRequest} onClose={() => setExpandedRequest(null)} />, document.body)}
      </>
    </DashboardLayout>
  );
}
