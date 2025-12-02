import { useMemo, useState, FormEvent, useEffect } from "react";
import { Shield, Megaphone, Sparkles, Inbox, X, Filter } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";
import { ADMIN_CORE_NAV_CARDS } from "../components/admin/adminNavConfig";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../lib/logger";
import { DateField } from "../components/forms/GlassyPickers";

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

export default function AdminDashboard() {
  const { session, role } = useAuth();
  const isAdmin = role === "admin";
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [publishDate, setPublishDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState<string | null>(null);
  const [expandedRequest, setExpandedRequest] = useState<ContactRequest | null>(null);
  const [contactTopicFilter, setContactTopicFilter] = useState<string>("all");

  const stats = useMemo<AdminStat[]>(
    () => [
      {
        label: "Admin Role",
        value: (role || "Admin").toUpperCase(),
        hint: "Highest privileges",
      },
      {
        label: "Core Panels",
        value: "02",
        hint: "RTO & Users",
      },
      {
        label: "Announcements",
        value: "Live",
        hint: "Supabase powered",
      },
    ],
    [role]
  );

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
    const interval = setInterval(fetchContactRequests, 60_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdmin]);

  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Admin Control Room",
      eyebrowIcon: <Sparkles className="w-4 h-4 text-[#f8dda7]" />,
      heading: `Welcome back, ${session?.user?.email?.split("@")[0] || "Admin"}`,
      description:
        "Track mission-critical tools, manage users, and keep everyone informed with polished announcements.",
      badges: [
        {
          label: role || "ADMIN",
          icon: <Shield className="w-4 h-4 text-[#f4c979]" />,
          variant: "solid",
        },
        {
          label: "Announcements ready",
          icon: <Megaphone className="w-4 h-4 text-[#f4c979]" />,
          variant: "outline",
        },
      ],
    }),
    [role, session?.user?.email]
  );

  const isValid = title.trim().length > 0 && message.trim().length > 0;

  const handleCreateAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) {
      setFeedback({ type: "error", message: "Title and message are required." });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);
      const payload = {
        title: title.trim(),
        message: message.trim(),
        author: session?.user?.email ?? "Admin Team",
        date:
          scheduleLater && publishDate
            ? publishDate
            : new Date().toISOString().slice(0, 10),
      };

      const { error } = await supabase.from("announcements").insert(payload);
      if (error) {
        logger.error("Failed to publish announcement:", error);
        setFeedback({
          type: "error",
          message: "Failed to publish announcement. Please try again.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: "Announcement published successfully.",
      });
      setTitle("");
      setMessage("");
      setScheduleLater(false);
      setPublishDate("");
    } catch (err) {
      logger.error("Unexpected error publishing announcement:", err);
      setFeedback({
        type: "error",
        message: "Something went wrong. Please try again shortly.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const announcementPanel = (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#fef3d1]/10 border border-[#f6dcb2]/40 rounded-full text-[0.65rem] font-semibold tracking-[0.3em] uppercase text-[#f8dfb3] mb-4">
            <Megaphone className="w-4 h-4 text-[#f5cf82]" />
            Publish Update
          </div>
          <h3 className="text-xl font-semibold text-white">Create Announcement</h3>
          <p className="text-sm text-[#f8e5bb]/80 mt-1">
            A subtle, premium touch—publish news that appears instantly on the announcements page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          disabled={composerOpen}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-transparent bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] px-5 py-2 text-sm font-semibold text-[#332308] shadow-[0_15px_30px_rgba(0,0,0,0.45)] transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0b09] disabled:cursor-not-allowed disabled:opacity-60"
          aria-expanded={composerOpen}
        >
          Create New Announcement
        </button>
      </div>

      {composerOpen ? (
        <>
          {feedback && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "bg-[#1d1a14] text-[#f4d589] border border-[#f4d589]/50"
                  : "bg-[#2b1414] text-[#f2a4a4] border border-[#f47373]/40"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleCreateAnnouncement}>
            <div>
              <label className="text-xs uppercase tracking-[0.35em] text-[#f3d9a4]/70 block mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New safety protocols"
                className="w-full bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 focus:ring-offset-2 focus:ring-offset-[#030201]"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.35em] text-[#f3d9a4]/70 block mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share the details your team should know..."
                rows={5}
                className="w-full bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 focus:ring-offset-2 focus:ring-offset-[#030201] resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-[#f8e5bb]/80">
                <input
                  type="checkbox"
                  checked={scheduleLater}
                  onChange={(e) => setScheduleLater(e.target.checked)}
                  className="accent-[#f4c979]"
                />
                Schedule publish date
              </label>
              {scheduleLater && (
                <DateField
                  label="Publish Date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  helperText="Announcement goes live at 12:01 AM local time"
                  containerClassName="text-white"
                  labelClassName="text-[0.65rem] uppercase tracking-[0.3em] text-[#f3d9a4]/70"
                  className="bg-[#050402]/80 border-[#f6dcb2]/20 focus:ring-[#f4c979]/70 focus:border-[#f4c979]/40"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={!isValid || submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02] font-semibold transition hover:scale-[1.01] border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050301] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Publishing..." : "Publish announcement"}
            </button>
            {submitting && (
              <div className="h-1 w-full rounded-full bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] animate-pulse" />
            )}
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4 text-xs text-[#f8e5bb]/70">
            <p className="leading-relaxed">
              Announcements publish directly to the Supabase `announcements` table and appear immediately on the employee announcements page.
            </p>
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="inline-flex items-center gap-1 font-semibold text-[#fcdca1] hover:text-white"
            >
              Hide composer
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-[#f8e5bb]/70 border-t border-white/5 pt-4">
          Keep the dashboard tidy—open the composer only when you need to publish an update.
        </p>
      )}
    </>
  );

  const filteredContactRequests = useMemo(() => {
    if (contactTopicFilter === "all") return contactRequests;
    return contactRequests.filter((request) => request.topic === contactTopicFilter);
  }, [contactRequests, contactTopicFilter]);

  const renderContactRequestsPanel = () => (
    <section className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-6 space-y-4 shadow-[0_35px_60px_rgba(0,0,0,0.6)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#f8dfb3]/80 flex items-center gap-2">
            <Inbox className="w-4 h-4 text-[#f4c979]" />
            Latest contact requests
          </p>
          <p className="text-sm text-[#f8e5bb]/70">
            Messages submitted through the Contact page are routed here for admin follow-up.
          </p>
        </div>
        <span className="text-xs text-[#f8e5bb]/60">
          {contactRequests.length} shown · refreshes every minute
        </span>
      </div>

      {contactRequests.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-[#f4c979]">
            <Filter className="w-4 h-4" />
            Filter topics
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "general", "hr", "safety", "payroll"].map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setContactTopicFilter(topic)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  contactTopicFilter === topic
                    ? "bg-[#f4c979] text-[#2e1b02] shadow-[0_5px_20px_rgba(0,0,0,0.35)]"
                    : "border border-white/10 text-[#f8e5bb]/80 hover:text-white"
                }`}
              >
                {topic === "all" ? "All topics" : CONTACT_TOPIC_LABELS[topic] ?? topic}
              </button>
            ))}
          </div>
          {contactTopicFilter !== "all" && (
            <button
              type="button"
              onClick={() => setContactTopicFilter("all")}
              className="text-xs font-semibold text-[#f8e5bb]/70 hover:text-white transition"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {contactError && (
        <div className="rounded-2xl border border-[#f47373]/40 bg-[#2b1414]/70 text-[#f2a4a4] px-4 py-3 text-sm">
          {contactError}
        </div>
      )}

      {contactLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/5 bg-white/5 h-32 animate-pulse"
            />
          ))}
        </div>
      ) : filteredContactRequests.length === 0 ? (
        <p className="text-sm text-[#f8e5bb]/70">
          {contactRequests.length === 0
            ? "No contact requests have been submitted yet. Encourage teams to use the Contact page when they need help."
            : "No requests match this filter. Try another topic or reset filters."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredContactRequests.map((request) => (
            <article
              key={request.id}
              className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/85 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{request.name}</p>
                  <a
                    href={`mailto:${request.email}`}
                    className="text-xs text-[#f4c979] hover:text-[#ffe6bc]"
                  >
                    {request.email}
                  </a>
                </div>
                <span className="text-[0.65rem] uppercase tracking-[0.25em] px-3 py-1 rounded-full border border-[#f6dcb2]/30 text-[#f8e5bb]/80">
                  {CONTACT_TOPIC_LABELS[request.topic] ?? request.topic}
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-white/80 leading-relaxed line-clamp-3">
                  {request.message}
                </p>
                <button
                  type="button"
                  onClick={() => setExpandedRequest(request)}
                  className="text-xs font-semibold tracking-wide text-[#f4c979] hover:text-white transition-colors"
                >
                  View full message
                </button>
              </div>
              <p className="text-xs text-[#f8e5bb]/60">
                {new Date(request.submitted_at).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );

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
        <AdminPremiumScaffold
          hero={heroConfig}
          stats={stats}
          navCards={ADMIN_CORE_NAV_CARDS}
          sidePanel={announcementPanel}
        >
          <div className="space-y-6">
            {renderContactRequestsPanel()}
          </div>
        </AdminPremiumScaffold>

        {expandedRequest && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-request-title"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setExpandedRequest(null)}
            />
            <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0c0804] p-6 text-white shadow-[0_45px_80px_rgba(0,0,0,0.7)] space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    id="contact-request-title"
                    className="text-sm font-semibold tracking-[0.3em] uppercase text-[#f4c979]"
                  >
                    Contact message
                  </p>
                  <p className="text-2xl font-semibold text-white mt-1">
                    {expandedRequest.name}
                  </p>
                  <a
                    href={`mailto:${expandedRequest.email}`}
                    className="text-sm text-[#f4c979] hover:text-white"
                  >
                    {expandedRequest.email}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedRequest(null)}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:text-white hover:bg-white/10 transition"
                  aria-label="Close full message"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-white/70 uppercase tracking-[0.3em]">
                  <span>{CONTACT_TOPIC_LABELS[expandedRequest.topic] ?? expandedRequest.topic}</span>
                  <span>{new Date(expandedRequest.submitted_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-white/90 leading-relaxed whitespace-pre-line">
                  {expandedRequest.message}
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setExpandedRequest(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] px-5 py-2 text-sm font-semibold text-[#2e1b02] hover:scale-[1.01] transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </DashboardLayout>
  );
}
