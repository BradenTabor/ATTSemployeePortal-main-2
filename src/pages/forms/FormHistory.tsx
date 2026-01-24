import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { BlurFade } from "../../components/ui/blur-fade";
import { FileText, ClipboardList, ChevronRight } from "lucide-react";

const hubCards = [
  {
    key: "dvir",
    path: "/forms-history/dvir",
    title: "Daily Vehicle Inspection (DVIR)",
    description: "Review your previously submitted DVIR forms.",
    icon: FileText,
  },
  {
    key: "jsa",
    path: "/forms-history/jsa",
    title: "Job Safety Analysis (JSA)",
    description: "Review your previously submitted JSA forms.",
    icon: ClipboardList,
  },
] as const;

export default function FormHistory() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  return (
    <DashboardLayout title="Forms History">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <BlurFade delay={0} duration={0.4} direction="up" offset={8} inView={false}>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] font-medium text-emerald-200/80">
              Compliance
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mt-1">
              Forms History
            </h2>
            <p className="text-sm text-white/70 mt-2 max-w-2xl leading-relaxed">
              View the history of forms you&apos;ve submitted. Select a form type below to see your previous submissions.
            </p>
          </div>
        </BlurFade>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {hubCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <BlurFade
                key={card.key}
                delay={0.06 + index * 0.04}
                inView={false}
                className="h-full"
              >
                <motion.button
                  type="button"
                  onClick={() => navigate(card.path)}
                  whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="group w-full flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent backdrop-blur-xl p-4 sm:p-5 text-left hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] outline-none transition-all duration-300 min-h-[80px] sm:min-h-[88px]"
                  aria-label={`Open ${card.title}`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex-shrink-0">
                      <Icon className="w-5 h-5 text-emerald-300" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                        {card.title}
                      </h3>
                      <p className="text-xs text-white/60 line-clamp-2 mt-1 leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className="w-5 h-5 text-emerald-400/60 flex-shrink-0 group-hover:text-emerald-300 transition-colors"
                    aria-hidden
                  />
                </motion.button>
              </BlurFade>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
