import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { useCertificationTypes, useMyCertificationRecords } from "../hooks/useCertifications";
import { CertificationCard } from "../components/certifications";
import { RefreshCw, ChevronRight, Shield } from "lucide-react";
import { TRAINING_ENTRIES } from "../content/trainingIndex";
import { SAFETY_ENTRIES } from "../content/safetyIndex";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import attsLogoStamped from "../assets/ATTS_Logo_stamped.png";
import { PowerSafeTrainingOverlay, PowerSafeStickyNote } from "../components/content/PowerSafeTrainingOverlay";

const SECTION_TITLE_STYLE = {
  backgroundImage:
    "linear-gradient(105deg, rgba(167, 243, 208, 1) 0%, rgba(110, 231, 183, 1) 25%, rgba(52, 211, 153, 1) 50%, rgba(16, 185, 129, 1) 75%, rgba(110, 231, 183, 1) 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  textShadow: "0 0 10px rgba(52, 211, 153, 0.35)",
} as const;

function SectionHeader({
  title,
  prefersReducedMotion,
}: {
  title: string;
  prefersReducedMotion: boolean;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-2 sm:mb-3 sm:gap-3">
      <motion.div
        className="flex shrink-0 items-center justify-center"
        aria-hidden
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <img
          src={attsLogoStamped}
          alt="ATTS Logo"
          className="h-9 w-9 object-contain sm:h-12 sm:w-12 md:h-14 md:w-14"
        />
      </motion.div>
      <h2
        className="text-sm font-semibold tracking-tight text-transparent bg-clip-text sm:text-base md:text-lg"
        style={SECTION_TITLE_STYLE}
      >
        {title}
      </h2>
    </div>
  );
}

export default function Resources() {
  const { user } = useAuth();
  const { data: types, isLoading: typesLoading, isError, refetch } = useCertificationTypes();
  const { data: records } = useMyCertificationRecords(user?.id);
  const prefersReducedMotion = useMemo(() => getDeviceCapabilities().prefersReducedMotion, []);
  const [powerSafeOverlayOpen, setPowerSafeOverlayOpen] = useState(false);
  const [powerSafeStickyVisible, setPowerSafeStickyVisible] = useState(false);

  const recordByCert = (id: string) =>
    records?.find((r) => r.certification_type_id === id) ?? null;

  const allowedCertSlugs = useMemo(
    () => new Set((types ?? []).map((c) => c.slug)),
    [types]
  );
  const visibleTrainingEntries = useMemo(
    () =>
      TRAINING_ENTRIES.filter(
        (e) => !e.certificationSlug || allowedCertSlugs.has(e.certificationSlug)
      ),
    [allowedCertSlugs]
  );

  const renderCertificationsContent = () => {
    if (typesLoading) {
      return (
        <div className="rounded-lg sm:rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-3 sm:p-4 text-center shadow-lg">
          <p className="text-emerald-200 text-sm">Loading…</p>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="rounded-lg sm:rounded-xl border border-red-500/30 bg-gradient-to-br from-red-950/50 to-neutral-900/70 backdrop-blur-sm p-3 sm:p-4 text-center shadow-lg">
          <p className="text-red-300 mb-2 text-xs sm:text-sm font-medium">
            Unable to load. Check connection.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            aria-label="Retry loading certifications"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-3 py-2 text-xs sm:text-sm font-medium text-white shadow-md transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Retry
          </button>
        </div>
      );
    }

    if (types?.length) {
      return (
        <div className="space-y-1.5 sm:space-y-2">
          {types.map((cert) => (
            <CertificationCard
              key={cert.id}
              cert={cert}
              record={recordByCert(cert.id)}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="rounded-lg sm:rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-3 sm:p-4 text-center shadow-lg">
        <p className="text-emerald-200 text-sm">No certifications available.</p>
        <p className="mt-1 text-xs text-emerald-100/70">
          Contact your administrator if you expect to see them here.
        </p>
      </div>
    );
  };

  const cardBase =
    "flex min-h-[44px] items-center justify-between gap-1.5 rounded-lg sm:rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-2.5 sm:p-3 text-left shadow-md transition-all sm:gap-3 hover:border-emerald-500/40 hover:bg-gradient-to-br hover:from-emerald-950/50 hover:to-neutral-900/70 hover:shadow-lg hover:shadow-emerald-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";
  const cardLogo = "h-8 w-8 object-contain sm:h-10 sm:w-10";

  return (
    <DashboardLayout title="Resources & Documents">
      <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6 w-full">
        {/* Power Safe Training CTA - Top of page, visible to all users */}
        <section className="flex justify-center">
          <motion.button
            type="button"
            onClick={() => setPowerSafeOverlayOpen(true)}
            className="group relative flex items-center justify-center gap-2 sm:gap-3 py-3 px-5 sm:py-4 sm:px-8 rounded-xl sm:rounded-2xl text-white font-bold text-base sm:text-lg shadow-xl sm:shadow-2xl transition-all duration-300 hover:scale-[1.02] sm:hover:scale-[1.03] hover:shadow-[0_15px_40px_-10px_rgba(139,92,246,0.5)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#010604] min-h-[48px] sm:min-h-[56px] overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 25%, #ec4899 50%, #3b82f6 75%, #7c3aed 100%)',
              backgroundSize: '200% 200%',
              animation: prefersReducedMotion ? 'none' : 'pulse-gradient 4s ease-in-out infinite',
            }}
            initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Shimmer overlay - hidden on mobile for performance */}
            <div
              className="hidden sm:block absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: prefersReducedMotion ? 'none' : 'shimmer-sweep 3s ease-in-out infinite',
              }}
            />
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 relative z-10 transition-transform group-hover:scale-110" />
            <span className="relative z-10">Power Safe Training</span>
          </motion.button>
        </section>

        <section>
          <SectionHeader title="Certifications" prefersReducedMotion={prefersReducedMotion} />
          <p className="mb-2 text-xs text-emerald-100/80 sm:text-sm sm:mb-3">
            Take certification tests and track your status.
          </p>
          {renderCertificationsContent()}
        </section>

        <section>
          <SectionHeader title="Training Materials" prefersReducedMotion={prefersReducedMotion} />
          <p className="mb-2 text-xs text-emerald-100/80 sm:text-sm sm:mb-3">
            Reference documents and study guides.
          </p>
          {visibleTrainingEntries.length > 0 ? (
            <div className="space-y-1.5 sm:space-y-2">
              {visibleTrainingEntries.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/resources/doc/training/${entry.slug}`}
                  className={cardBase}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                    <div className="flex shrink-0 items-center justify-center">
                      <img src={attsLogoStamped} alt="ATTS Logo" className={cardLogo} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white sm:text-sm">{entry.title}</p>
                      {entry.description && (
                        <p className="truncate text-[10px] text-emerald-100/70 sm:text-xs">{entry.description}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg sm:rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-3 sm:p-4 text-center shadow-lg">
              <p className="text-emerald-200 text-sm">No training materials available.</p>
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Safety Resources" prefersReducedMotion={prefersReducedMotion} />
          <p className="mb-2 text-xs text-emerald-100/80 sm:text-sm sm:mb-3">
            Quick reference and safety guidelines.
          </p>
          {SAFETY_ENTRIES.length > 0 ? (
            <div className="space-y-1.5 sm:space-y-2">
              {SAFETY_ENTRIES.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/resources/doc/safety/${entry.slug}`}
                  className={cardBase}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                    <div className="flex shrink-0 items-center justify-center">
                      <img src={attsLogoStamped} alt="ATTS Logo" className={cardLogo} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white sm:text-sm">{entry.title}</p>
                      {entry.description && (
                        <p className="truncate text-[10px] text-emerald-100/70 sm:text-xs">{entry.description}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg sm:rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-3 sm:p-4 text-center shadow-lg">
              <p className="text-emerald-200 text-sm">No safety resources available.</p>
            </div>
          )}
        </section>
      </div>

      {/* Power Safe Training Overlay */}
      <PowerSafeTrainingOverlay
        isOpen={powerSafeOverlayOpen}
        onClose={() => setPowerSafeOverlayOpen(false)}
        onPinStickyNote={() => {
          setPowerSafeStickyVisible(true);
          setPowerSafeOverlayOpen(false);
        }}
      />

      {/* Power Safe Sticky Note - persists when user navigates to external portal */}
      <PowerSafeStickyNote
        isVisible={powerSafeStickyVisible}
        onClose={() => setPowerSafeStickyVisible(false)}
      />
    </DashboardLayout>
  );
}
