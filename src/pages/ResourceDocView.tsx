import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { getTrainingMarkdown, getTrainingEntry, type TrainingEntry } from "../content/trainingIndex";
import { getSafetyMarkdown, getSafetyEntry, type SafetyEntry } from "../content/safetyIndex";
import { useCertificationTypes } from "../hooks/useCertifications";
import { StudyGuideProse } from "../components/content/StudyGuideProse";
import { getDeviceCapabilities } from "../lib/mobilePerf";

type DocSection = "training" | "safety";

interface DocConfig {
  getMarkdown: (slug: string) => string | null;
  getEntry: (slug: string) => TrainingEntry | SafetyEntry | null;
  sectionTitle: string;
}

const DOC_CONFIGS: Record<DocSection, DocConfig> = {
  training: {
    getMarkdown: getTrainingMarkdown,
    getEntry: getTrainingEntry,
    sectionTitle: "Training Materials",
  },
  safety: {
    getMarkdown: getSafetyMarkdown,
    getEntry: getSafetyEntry,
    sectionTitle: "Safety Resources",
  },
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

export default function ResourceDocView() {
  const { section, slug } = useParams<{ section: DocSection; slug: string }>();
  const { data: certificationTypes } = useCertificationTypes();
  const allowedCertSlugs = useMemo(
    () => new Set((certificationTypes ?? []).map((c) => c.slug)),
    [certificationTypes]
  );
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const prefersReducedMotion = caps.prefersReducedMotion;

  const motionProps = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 8 } as const, animate: { opacity: 1, y: 0 } as const, transition: { duration: 0.3, ease: "easeOut" as const } };

  // ─── Invalid section/slug ─────────────────────────────────────────
  if (!section || !slug || !(section in DOC_CONFIGS)) {
    return (
      <DashboardLayout title="Document Not Found" pageHeading>
        <div className="mx-auto max-w-2xl px-4 space-y-6">
          <Link
            to="/resources"
            className={`inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white ${FOCUS_RING}`}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
            Resources
          </Link>
          <div className="rounded-xl border border-red-500/20 bg-gray-900 px-4 py-3 shadow-md shadow-black/20">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" strokeWidth={1.5} aria-hidden />
              <p className="text-sm text-white/60">Document not found.</p>
            </div>
            <Link
              to="/resources"
              className={`mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-black/20 transition-all duration-150 ${FOCUS_RING}`}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
              Back to Resources
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const config = DOC_CONFIGS[section];
  const entry = config.getEntry(slug);
  const markdown = config.getMarkdown(slug);

  // ─── Entry or markdown not found ──────────────────────────────────
  if (!entry || !markdown) {
    return (
      <DashboardLayout title="Document Not Found" pageHeading>
        <div className="mx-auto max-w-2xl px-4 space-y-6">
          <Link
            to="/resources"
            className={`inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white ${FOCUS_RING}`}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
            Resources
          </Link>
          <div className="rounded-xl border border-red-500/20 bg-gray-900 px-4 py-3 shadow-md shadow-black/20">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" strokeWidth={1.5} aria-hidden />
              <p className="text-sm text-white/60">The requested document could not be found.</p>
            </div>
            <Link
              to="/resources"
              className={`mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-black/20 transition-all duration-150 ${FOCUS_RING}`}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
              Back to Resources
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Access restricted (training docs gated by cert) ──────────────
  const trainingEntry = section === "training" ? (entry as TrainingEntry) : null;
  const needsCertAccess = trainingEntry?.certificationSlug != null;
  const hasAccess = !needsCertAccess || allowedCertSlugs.has(trainingEntry!.certificationSlug!);
  if (needsCertAccess && !hasAccess) {
    return (
      <DashboardLayout title="Access restricted" pageHeading>
        <div className="mx-auto max-w-2xl px-4 space-y-6">
          <Link
            to="/resources"
            className={`inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white ${FOCUS_RING}`}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
            Resources
          </Link>
          <div className="rounded-xl border border-amber-500/20 bg-gray-900 px-4 py-3 shadow-md shadow-black/20">
            <div className="flex items-center gap-2.5 mb-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" strokeWidth={1.5} aria-hidden />
              <p className="text-sm font-medium text-amber-300">Access restricted</p>
            </div>
            <p className="text-sm text-white/60 mb-3">
              Contact an administrator to request access to this certification.
            </p>
            <Link
              to="/resources"
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-black/20 transition-all duration-150 ${FOCUS_RING}`}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
              Back to Resources
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Document view ────────────────────────────────────────────────
  return (
    <DashboardLayout title={entry.title} pageHeading>
      <motion.div className="mx-auto max-w-2xl space-y-6 sm:space-y-8 px-4" {...motionProps}>
        {/* Back nav */}
        <Link
          to="/resources"
          className={`inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white ${FOCUS_RING}`}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          Resources
        </Link>

        {/* Page header */}
        <header>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80 mb-1">
            {config.sectionTitle}
          </p>
          <h1 className="text-2xl font-bold text-white">{entry.title}</h1>
        </header>

        {/* Content card */}
        <div className="rounded-xl border border-white/10 bg-gray-900 px-6 py-8 sm:px-8 sm:py-10 shadow-md shadow-black/20">
          <StudyGuideProse
            markdown={markdown}
            prefersReducedMotion={prefersReducedMotion}
          />
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
