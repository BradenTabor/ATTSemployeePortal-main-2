import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { ArrowLeft } from "lucide-react";
import { getTrainingMarkdown, getTrainingEntry, type TrainingEntry } from "../content/trainingIndex";
import { getSafetyMarkdown, getSafetyEntry, type SafetyEntry } from "../content/safetyIndex";
import { useCertificationTypes } from "../hooks/useCertifications";
import { StudyGuideProse } from "../components/content/StudyGuideProse";
import { TextEffect } from "../components/ui/TextEffect";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import attsLogoStamped from "../assets/ATTS_Logo_stamped.png";

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

const TITLE_GRADIENT_GREEN = {
  backgroundImage:
    "linear-gradient(105deg, rgba(167, 243, 208, 1) 0%, rgba(110, 231, 183, 1) 25%, rgba(52, 211, 153, 1) 50%, rgba(16, 185, 129, 1) 75%, rgba(110, 231, 183, 1) 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  textShadow: "0 0 10px rgba(52, 211, 153, 0.35)",
} as const;

export default function ResourceDocView() {
  const { section, slug } = useParams<{ section: DocSection; slug: string }>();
  const { data: certificationTypes } = useCertificationTypes();
  const allowedCertSlugs = useMemo(
    () => new Set((certificationTypes ?? []).map((c) => c.slug)),
    [certificationTypes]
  );
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const prefersReducedMotion = caps.prefersReducedMotion;

  if (!section || !slug || !(section in DOC_CONFIGS)) {
    return (
      <DashboardLayout title="Document Not Found">
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-6 text-center shadow-lg">
            <p className="text-emerald-200 mb-4 font-medium">Document not found.</p>
            <p className="text-emerald-100/80 mb-4 text-sm font-medium">
              The page may have been moved or removed. Try selecting another document from Resources.
            </p>
            <Link
              to="/resources"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-4 py-3 text-white font-medium shadow-md transition-all hover:shadow-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
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

  if (!entry || !markdown) {
    return (
      <DashboardLayout title="Document Not Found">
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-6 text-center shadow-lg">
            <p className="text-emerald-200 mb-4 font-medium">
              The requested document could not be found.
            </p>
            <p className="text-emerald-100/80 mb-4 text-sm font-medium">
              It may have been moved or removed. Try selecting another from Resources.
            </p>
            <Link
              to="/resources"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-4 py-3 text-white font-medium shadow-md transition-all hover:shadow-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to Resources
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const trainingEntry = section === "training" ? (entry as TrainingEntry) : null;
  const needsCertAccess = trainingEntry?.certificationSlug != null;
  const hasAccess = !needsCertAccess || allowedCertSlugs.has(trainingEntry!.certificationSlug!);
  if (needsCertAccess && !hasAccess) {
    return (
      <DashboardLayout title="Access restricted">
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 to-neutral-900/60 backdrop-blur-sm p-6 text-center shadow-lg">
            <p className="text-amber-200 mb-4 font-medium">
              You don&apos;t have access to this study guide.
            </p>
            <p className="text-amber-100/80 mb-4 text-sm font-medium">
              Contact an administrator to request access to this certification.
            </p>
            <Link
              to="/resources"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-4 py-3 text-white font-medium shadow-md transition-all hover:shadow-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to Resources
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={entry.title}>
      <div className="mx-auto max-w-2xl space-y-6 px-4">
        <Link
          to="/resources"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-emerald-200 hover:text-emerald-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to Resources
        </Link>

        <div className="flex items-center gap-4">
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
              className="h-20 w-20 object-contain sm:h-24 sm:w-24"
            />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/80">
              {config.sectionTitle}
            </p>
            {prefersReducedMotion ? (
              <h1
                className="text-xl font-bold tracking-tight text-transparent bg-clip-text sm:text-2xl"
                style={TITLE_GRADIENT_GREEN}
              >
                {entry.title}
              </h1>
            ) : (
              <TextEffect
                as="h1"
                preset="blurSlide"
                per="word"
                delay={0.08}
                className="text-xl font-bold tracking-tight sm:text-2xl"
                segmentWrapperClassName="title-gradient-green bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]"
                trigger
              >
                {entry.title}
              </TextEffect>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm px-6 py-8 shadow-lg sm:px-8 sm:py-10">
          <StudyGuideProse
            markdown={markdown}
            prefersReducedMotion={prefersReducedMotion}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
