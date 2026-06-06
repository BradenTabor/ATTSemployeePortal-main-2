import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Phone, Mail, Search, Users, RefreshCw, ChevronDown } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useTeamContactsQuery, type TeamContact } from "../hooks/queries/useTeamContactsQuery";
import { UserAvatar } from "../components/ui/UserAvatar";
import { HistoryEmptyState } from "../components/history/HistoryEmptyState";
import { TextEffect } from "../components/ui/TextEffect";
import { glass } from "../lib/glass";
import { getDeviceCapabilities } from "../lib/mobilePerf";

const ALL_ROLES = [
  { value: "", label: "All Roles" },
  { value: "employee", label: "Employee" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "mechanic", label: "Mechanic" },
  { value: "foreman", label: "Foreman" },
  { value: "general_foreman", label: "General Foreman" },
  { value: "safety_officer", label: "Safety Officer" },
] as const;

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin:           { bg: "bg-[#f4c979]/15", text: "text-[#f8e5bb]",    border: "border-[#f4c979]/30" },
  manager:         { bg: "bg-[#f4c979]/15", text: "text-[#f8e5bb]",    border: "border-[#f4c979]/30" },
  mechanic:        { bg: "bg-orange-500/15", text: "text-orange-200",   border: "border-orange-500/30" },
  foreman:         { bg: "bg-blue-500/15",   text: "text-blue-200",     border: "border-blue-500/30" },
  general_foreman: { bg: "bg-purple-500/15", text: "text-purple-200",   border: "border-purple-500/30" },
  safety_officer:  { bg: "bg-red-500/15",    text: "text-red-200",      border: "border-red-500/30" },
  employee:        { bg: "bg-emerald-500/15", text: "text-emerald-200", border: "border-emerald-500/30" },
};

const STAGGER_CAP = 12;

function formatRoleLabel(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7);
    return `(${area}) ${prefix}-${line}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export default function TeamContacts() {
  const { data: contacts, isLoading, isError, refetch } = useTeamContactsQuery();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  const filtered = useMemo(() => {
    if (!contacts) return [];
    let result = contacts;

    if (roleFilter) {
      result = result.filter((c) => c.role === roleFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone_number?.includes(q)
      );
    }

    return result;
  }, [contacts, roleFilter, search]);

  return (
    <DashboardLayout title="Team Contacts" pageHeading>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Glass Header */}
        <div className="mb-5 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div
              className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              style={{
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                background:
                  "linear-gradient(145deg, rgba(4, 30, 21, 0.6) 0%, rgba(2, 15, 10, 0.5) 50%, rgba(1, 8, 5, 0.4) 100%)",
                boxShadow:
                  "inset 0 0 15px rgba(125, 225, 180, 0.05), 0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="absolute inset-0 opacity-70 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(125deg, rgba(255,255,255,0.15) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)",
                }}
              />
              <div
                className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent"
              />

              <div className="relative px-5 py-4 md:px-7 md:py-5">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-400" aria-hidden />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-200">
                      Team Directory
                    </span>
                  </motion.div>
                  {contacts && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#03150f]/60 border border-emerald-500/20"
                    >
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-200/70">
                        {contacts.length} {contacts.length === 1 ? "member" : "members"}
                      </span>
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{
                      duration: 0.6,
                      delay: 0.3,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 origin-top flex-shrink-0"
                    style={{
                      boxShadow:
                        "0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.2)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect
                        as="h1"
                        preset="blurSlide"
                        per="char"
                        delay={0.15}
                        className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight"
                        segmentWrapperClassName="bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(125,225,180,0.3)]"
                      >
                        ATTS Team Contacts
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent">
                        ATTS Team Contacts
                      </h1>
                    )}
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.7 }}
                      className="mt-1.5 md:mt-2 text-xs sm:text-sm text-emerald-200/50 font-medium leading-relaxed max-w-xl"
                    >
                      Tap a phone number or email to connect instantly
                    </motion.p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search / Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className={`${glass.subtle} p-3 sm:p-4 mb-5 flex flex-col sm:flex-row gap-3`}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" aria-hidden />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/[0.06] bg-black/30 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            />
          </div>

          <div className="relative shrink-0 sm:w-48">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full appearance-none rounded-xl border border-white/[0.06] bg-black/30 px-4 py-2.5 pr-9 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              {ALL_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" aria-hidden />
          </div>

          {(search || roleFilter) && (
            <div className="flex items-center gap-2 text-xs text-white/50 shrink-0 self-center">
              <span>
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => { setSearch(""); setRoleFilter(""); }}
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </motion.div>

        {/* Content States */}
        {isLoading && <SkeletonGrid />}

        {isError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${glass.card} border-rose-500/20 px-6 py-10 flex flex-col items-center text-center`}
          >
            <div className={`w-14 h-14 rounded-2xl ${glass.subtle} flex items-center justify-center mb-4`}>
              <RefreshCw className="w-7 h-7 text-rose-400/60" aria-hidden />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Unable to load contacts
            </h3>
            <p className="text-sm text-white/50 max-w-sm mx-auto leading-relaxed mb-6">
              Something went wrong while fetching the team directory. Please check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-5 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <RefreshCw className="w-4 h-4" aria-hidden />
              Retry
            </button>
          </motion.div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <HistoryEmptyState
            title="No teammates found"
            description={
              search || roleFilter
                ? "Try adjusting your search or filter to find who you're looking for."
                : "No active team members are available right now."
            }
            icon={
              <div className={`w-14 h-14 rounded-2xl ${glass.subtle} flex items-center justify-center`}>
                <Users className="w-7 h-7 text-white/40" aria-hidden />
              </div>
            }
          />
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map((contact, i) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                index={i}
                animate={enableAnimations}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ContactCard({
  contact,
  index,
  animate,
}: {
  contact: TeamContact;
  index: number;
  animate: boolean;
}) {
  const roleStyle = ROLE_COLORS[contact.role] ?? ROLE_COLORS.employee;
  const shouldStagger = animate && index < STAGGER_CAP;

  return (
    <motion.article
      initial={shouldStagger ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldStagger
          ? { duration: 0.3, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }
          : { duration: 0 }
      }
      className={`${glass.card} p-4 sm:p-5 hover:border-emerald-500/20 transition-colors group`}
    >
      {/* Top Row: Avatar + Name + Role */}
      <div className="flex items-center gap-3 mb-4">
        <UserAvatar
          avatarUrl={contact.avatar_url}
          name={contact.full_name}
          email={contact.email}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-semibold text-white truncate">
            {contact.full_name || "Unnamed User"}
          </p>
          <span
            className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-[0.12em] font-bold ${roleStyle.bg} ${roleStyle.text} border ${roleStyle.border}`}
          >
            {formatRoleLabel(contact.role)}
          </span>
        </div>
      </div>

      {/* Contact Actions */}
      <div className="space-y-2.5">
        {contact.phone_number ? (
          <a
            href={`tel:${contact.phone_number}`}
            className="flex items-center gap-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 px-3.5 py-2.5 text-sm text-emerald-200 hover:bg-emerald-500/[0.12] hover:border-emerald-500/30 transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            <Phone className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden />
            <span className="font-medium truncate">
              {formatPhoneDisplay(contact.phone_number)}
            </span>
          </a>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3.5 py-2.5 text-sm text-white/30 min-h-[44px]">
            <Phone className="w-4 h-4 shrink-0" aria-hidden />
            <span className="italic">Phone not available</span>
          </div>
        )}

        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 px-3.5 py-2.5 text-sm text-emerald-200 hover:bg-emerald-500/[0.12] hover:border-emerald-500/30 transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            <Mail className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden />
            <span className="font-medium truncate">{contact.email}</span>
          </a>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3.5 py-2.5 text-sm text-white/30 min-h-[44px]">
            <Mail className="w-4 h-4 shrink-0" aria-hidden />
            <span className="italic">Email not available</span>
          </div>
        )}
      </div>
    </motion.article>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`${glass.card} p-4 sm:p-5 animate-pulse`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-white/[0.06]" />
              <div className="h-3 w-20 rounded bg-white/[0.04]" />
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="h-[44px] rounded-xl bg-white/[0.03]" />
            <div className="h-[44px] rounded-xl bg-white/[0.03]" />
          </div>
        </div>
      ))}
    </div>
  );
}
