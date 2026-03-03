import { motion } from 'framer-motion';
import type { MergedProtocol } from '../../lib/emergency';
import type { EmergencyActionPlanConfig } from '../../config/emergency/types';
import { getTelUri } from '../../lib/emergency';
import PostIncidentChecklist from './PostIncidentChecklist';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';

const CARD_SHADOW = 'shadow-[0_1px_3px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]';

const stepVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

interface ActionStepsProps {
  protocol: MergedProtocol;
  config: EmergencyActionPlanConfig;
}

function getContact(config: EmergencyActionPlanConfig, key: string) {
  switch (key) {
    case 'siteSuper':
      return config.contacts.siteSuper;
    case 'safetyOfficer':
      return config.contacts.safetyOfficer;
    case '911':
      return null;
    default:
      return null;
  }
}

function StepBadge({ step }: { step: number }) {
  return (
    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-b from-red-500 to-red-700 text-white font-bold text-sm flex items-center justify-center shadow-[0_2px_6px_rgba(220,38,38,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]">
      {step}
    </span>
  );
}

export default function ActionSteps({ protocol, config }: ActionStepsProps) {
  const labels = protocol.labels.length > 0 ? protocol.labels : ['Emergency'];
  const label = labels.join(' + ');
  let stepIdx = 0;

  return (
    <section
      className="space-y-6"
      aria-labelledby="action-steps-heading"
      role="region"
    >
      <h2 id="action-steps-heading" className="text-xl font-bold text-white">
        {label} — Response Steps
      </h2>

      {/* Step 1: CALL 911 */}
      {protocol.call911 && (
        <motion.div className="space-y-2" variants={stepVariants} initial="hidden" animate="visible" custom={stepIdx++}>
          <div className="flex items-center gap-3">
            <StepBadge step={1} />
            <h3 className="text-sm font-bold text-red-300 uppercase tracking-wider">
              Call 911
            </h3>
          </div>
          <motion.a
            href="tel:911"
            className={`
              block w-full py-5 px-4
              bg-[linear-gradient(to_bottom,#ef4444_0%,#dc2626_40%,#b91c1c_100%)]
              text-white text-xl sm:text-2xl font-bold text-center
              rounded-xl min-h-[56px]
              shadow-[0_0_20px_rgba(220,38,38,0.3),0_2px_6px_rgba(0,0,0,0.3),0_8px_20px_rgba(153,27,27,0.35)]
              ${FOCUS_RING}
            `}
            whileHover={{
              scale: 1.01,
              boxShadow: '0 0 30px rgba(220,38,38,0.45), 0 2px 6px rgba(0,0,0,0.3), 0 12px 28px rgba(153,27,27,0.45)',
            }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            aria-label="Call 911 emergency services"
          >
            <span aria-hidden="true" className="mr-2">☎️</span>
            CALL 911 NOW
          </motion.a>
        </motion.div>
      )}

      {/* Step 2: Immediate actions */}
      <motion.div className="space-y-2" variants={stepVariants} initial="hidden" animate="visible" custom={stepIdx++}>
        <div className="flex items-center gap-3">
          <StepBadge step={protocol.call911 ? 2 : 1} />
          <h3 className="text-sm font-bold text-red-300 uppercase tracking-wider">
            Immediate actions
          </h3>
        </div>
        <div className={`bg-gradient-to-b from-slate-800 to-slate-800/90 border border-slate-700/80 rounded-xl p-5 ${CARD_SHADOW}`}>
          <ul className="space-y-2.5">
            {protocol.immediateActions.map((action, i) => (
              <li key={i} className="flex items-start gap-3 text-sm sm:text-base">
                <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-full bg-gradient-to-b from-red-800/80 to-red-900/80 border border-red-700/50 text-red-300 text-xs flex items-center justify-center font-semibold">
                  {i + 1}
                </span>
                <span className="text-slate-200 leading-relaxed">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>

      {/* Step 3: Notify leadership */}
      <motion.div className="space-y-2" variants={stepVariants} initial="hidden" animate="visible" custom={stepIdx++}>
        <div className="flex items-center gap-3">
          <StepBadge step={protocol.call911 ? 3 : 2} />
          <h3 className="text-sm font-bold text-red-300 uppercase tracking-wider">
            Notify leadership
          </h3>
        </div>
        <div className={`bg-gradient-to-b from-slate-800 to-slate-800/90 border border-slate-700/80 rounded-xl p-5 ${CARD_SHADOW}`}>
          <ul className="space-y-3 text-sm">
            {protocol.contactPriority
              .filter((k) => k !== '911' && k !== 'utility')
              .map((key) => {
                const contact = getContact(config, key);
                if (!contact) return null;
                const tel = getTelUri(contact.phone);
                return (
                  <li key={key} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" aria-hidden="true" />
                    {tel ? (
                      <a
                        href={tel}
                        className={`text-red-300 hover:text-red-200 font-semibold underline underline-offset-2 decoration-red-400/40 hover:decoration-red-300/60 transition-colors ${FOCUS_RING}`}
                        aria-label={`Call ${contact.name}, ${contact.title}`}
                      >
                        {contact.name} ({contact.title}) — {contact.phone}
                      </a>
                    ) : (
                      <span className="text-slate-300">
                        {contact.name} ({contact.title}) — {contact.phone}
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      </motion.div>

      {/* Critical notes */}
      {protocol.criticalNotes.length > 0 && (
        <motion.div
          className="bg-gradient-to-b from-amber-950/70 to-amber-950/50 border border-amber-700/40 border-l-4 border-l-amber-500 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(251,191,36,0.05)]"
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          custom={stepIdx++}
        >
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span aria-hidden="true">⚠️</span>
            Critical notes
          </h3>
          <ul className="space-y-2">
            {protocol.criticalNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-200 leading-relaxed">
                <span className="text-amber-500 mt-0.5 select-none" aria-hidden="true">•</span>
                {note}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* While waiting for help */}
      {protocol.whileWaiting.length > 0 && (
        <motion.div
          className={`bg-gradient-to-b from-slate-800 to-slate-800/90 border border-slate-700/80 rounded-xl p-5 ${CARD_SHADOW}`}
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          custom={stepIdx++}
        >
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
            While waiting for help
          </h3>
          <ul className="space-y-2">
            {protocol.whileWaiting.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
                <span className="text-slate-600 mt-0.5 select-none" aria-hidden="true">•</span>
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Do NOT */}
      {protocol.doNot.length > 0 && (
        <motion.div
          className="bg-gradient-to-b from-red-950/60 to-red-950/40 border border-red-800/40 border-l-4 border-l-red-500 rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(220,38,38,0.04)]"
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          custom={stepIdx++}
        >
          <h3 className="text-sm font-bold text-red-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span aria-hidden="true">🚫</span>
            Do NOT
          </h3>
          <ul className="space-y-2">
            {protocol.doNot.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-200 leading-relaxed">
                <span className="text-red-500 mt-0.5 select-none" aria-hidden="true">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Step 4: Hospital */}
      <motion.div className="space-y-2" variants={stepVariants} initial="hidden" animate="visible" custom={stepIdx++}>
        <div className="flex items-center gap-3">
          <StepBadge step={protocol.call911 ? 4 : 3} />
          <h3 className="text-sm font-bold text-red-300 uppercase tracking-wider">
            Nearest hospital
          </h3>
        </div>
        <div className={`bg-gradient-to-b from-slate-800 to-slate-800/90 border border-slate-700/80 rounded-xl p-5 ${CARD_SHADOW}`}>
          <p className="text-white font-medium text-sm mb-1">
            {config.site.nearestHospital.name}
          </p>
          <p className="text-slate-400 text-sm mb-3">
            {config.site.nearestHospital.address}
          </p>
          {getTelUri(config.site.nearestHospital.phone) && (
            <a
              href={getTelUri(config.site.nearestHospital.phone)!}
              className={`
                inline-flex items-center gap-2
                text-red-300 hover:text-red-200 font-semibold text-sm
                underline underline-offset-2 decoration-red-400/40 hover:decoration-red-300/60
                transition-colors
                ${FOCUS_RING}
              `}
              aria-label={`Call ${config.site.nearestHospital.name}`}
            >
              <span aria-hidden="true">📞</span>
              {config.site.nearestHospital.phone}
            </a>
          )}
        </div>
      </motion.div>

      <PostIncidentChecklist config={config} />
    </section>
  );
}
