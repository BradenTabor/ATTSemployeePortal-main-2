import { useMemo, useState, FormEvent } from "react";
import { Shield, Megaphone, Sparkles } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";
import { ADMIN_CORE_NAV_CARDS } from "../components/admin/adminNavConfig";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { logger } from "../lib/logger";

export default function AdminDashboard() {
  const { session, role } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [publishDate, setPublishDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  // Security check: only render admin content for admin users
  if (role !== "admin") {
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
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full bg-[#050402]/80 border border-[#f6dcb2]/20 rounded-2xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 focus:ring-offset-2 focus:ring-offset-[#030201]"
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

  return (
    <DashboardLayout title="Admin Panel">
      <AdminPremiumScaffold
        hero={heroConfig}
        stats={stats}
        navCards={ADMIN_CORE_NAV_CARDS}
        sidePanel={announcementPanel}
      />
    </DashboardLayout>
  );
}
