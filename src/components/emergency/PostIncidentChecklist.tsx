import { motion } from 'framer-motion';
import type { EmergencyActionPlanConfig } from '../../config/emergency/types';
import { getTelUri } from '../../lib/emergency';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';

interface PostIncidentChecklistProps {
  config: EmergencyActionPlanConfig;
}

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

function ChecklistStep({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <motion.li
      className="flex gap-4"
      variants={itemVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20px' }}
      custom={step - 1}
    >
      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-b from-slate-600 to-slate-700 border border-slate-500/50 text-white font-bold text-sm flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]">
        {step}
      </span>
      <div className="flex-1 pt-0.5">{children}</div>
    </motion.li>
  );
}

export default function PostIncidentChecklist({ config }: PostIncidentChecklistProps) {
  const primaryMuster = config.site.musterPoints.find((m) => m.type === 'primary');
  const accountability = config.roles.accountability.primary;
  const oshaPhone = config.contacts.osha.phone;

  return (
    <section
      className="mt-8 pt-8"
      aria-labelledby="post-incident-heading"
    >
      <div className="border-t border-slate-700/60 mb-6" />

      <h2
        id="post-incident-heading"
        className="text-xl font-bold text-white mb-6 flex items-center gap-3"
      >
        <span className="w-10 h-10 rounded-xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-600/50 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]" aria-hidden="true">
          📋
        </span>
        When the emergency is under control
      </h2>

      <ol className="space-y-5 list-none p-0 m-0">
        <ChecklistStep step={1}>
          <p className="font-semibold text-white text-sm sm:text-base">Account for everyone.</p>
          {primaryMuster && (
            <p className="text-slate-400 text-sm mt-1.5">
              Report to muster point:{' '}
              <span className="text-white font-medium">{primaryMuster.name}</span>
            </p>
          )}
          <p className="text-slate-400 text-sm mt-1">
            Accountability Officer:{' '}
            <span className="text-white font-medium">
              {accountability.name} ({accountability.title})
            </span>
            {getTelUri(accountability.phone) && (
              <>
                {' — '}
                <a
                  href={getTelUri(accountability.phone)!}
                  className={`text-red-300 hover:text-red-200 underline underline-offset-2 decoration-red-400/40 transition-colors ${FOCUS_RING}`}
                  aria-label={`Call ${accountability.name}, Accountability Officer`}
                >
                  {accountability.phone}
                </a>
              </>
            )}
          </p>
        </ChecklistStep>

        <ChecklistStep step={2}>
          <p className="font-semibold text-white text-sm sm:text-base">Preserve the scene.</p>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
            Do not clean up, move equipment, or disturb the area until cleared by the Safety
            Officer and, if applicable, an OSHA investigator.
          </p>
        </ChecklistStep>

        <ChecklistStep step={3}>
          <p className="font-semibold text-white text-sm sm:text-base">Document now, while it is fresh.</p>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
            Write down what happened: time, location, who was involved, what you saw. Take
            photos of the scene if it is safe to do so.
          </p>
        </ChecklistStep>

        <ChecklistStep step={4}>
          <p className="font-semibold text-white text-sm sm:text-base">OSHA reporting deadlines:</p>
          <div className="mt-2 space-y-2">
            <div className="bg-gradient-to-r from-red-950/60 to-red-950/30 border border-red-800/30 rounded-lg px-4 py-2.5">
              <p className="text-red-200 text-sm font-medium">
                Fatality → {config.contacts.osha.reportingDeadlines.fatality}
              </p>
            </div>
            <div className="bg-gradient-to-r from-amber-950/60 to-amber-950/30 border border-amber-800/30 rounded-lg px-4 py-2.5">
              <p className="text-amber-200 text-sm font-medium">
                Hospitalization, amputation, or eye loss →{' '}
                {config.contacts.osha.reportingDeadlines.hospitalization}
              </p>
            </div>
            <p className="text-slate-400 text-sm mt-2">
              Call OSHA:{' '}
              {getTelUri(oshaPhone) ? (
                <a
                  href={getTelUri(oshaPhone)!}
                  className={`text-red-300 hover:text-red-200 underline underline-offset-2 decoration-red-400/40 transition-colors ${FOCUS_RING}`}
                  aria-label="Call OSHA to report incident"
                >
                  {oshaPhone}
                </a>
              ) : (
                <span className="text-white">{oshaPhone}</span>
              )}{' '}
              or{' '}
              <a
                href={config.contacts.osha.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-red-300 hover:text-red-200 underline underline-offset-2 decoration-red-400/40 transition-colors ${FOCUS_RING}`}
                aria-label="Report incident to OSHA online"
              >
                report online
              </a>
            </p>
          </div>
        </ChecklistStep>

        <ChecklistStep step={5}>
          <p className="font-semibold text-white text-sm sm:text-base">Check on your people.</p>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
            Witnessing a serious incident is traumatic. Check in with workers who were nearby.
            It is normal to feel shaken, anxious, or upset. Encourage anyone struggling to
            speak with a supervisor or contact the Employee Assistance Program (EAP).
          </p>
          <p className="text-slate-600 text-xs mt-3 italic">
            Information outdated? Contact {config.contacts.safetyOfficer.name} (
            {config.contacts.safetyOfficer.phone})
          </p>
        </ChecklistStep>
      </ol>
    </section>
  );
}
