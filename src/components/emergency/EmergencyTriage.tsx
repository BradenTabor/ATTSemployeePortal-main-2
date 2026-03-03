import { motion } from 'framer-motion';
import type { EmergencyType, EmergencyProtocol } from '../../config/emergency/types';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';

interface EmergencyTriageProps {
  protocols: EmergencyProtocol[];
  selectedTypes: Set<EmergencyType>;
  onToggle: (type: EmergencyType) => void;
}

const buttonVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

export default function EmergencyTriage({
  protocols,
  selectedTypes,
  onToggle,
}: EmergencyTriageProps) {
  return (
    <div role="region" aria-label="Emergency type selection" className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">What&apos;s happening?</h2>
        {protocols.length > 1 && (
          <p className="text-slate-400 text-sm mt-1">
            Multiple emergencies? Tap all that apply.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {protocols.map((p, i) => {
          const isSelected = selectedTypes.has(p.type);
          return (
            <motion.button
              key={p.type}
              type="button"
              onClick={() => onToggle(p.type)}
              className={`
                emergency-triage-button
                flex flex-col items-center justify-center gap-2
                py-5 px-4
                rounded-xl
                min-h-[88px]
                transition-colors duration-150
                ${FOCUS_RING}
                ${
                  isSelected
                    ? p.type === 'equipment-fire'
                      ? 'bg-[linear-gradient(90deg,rgba(176,78,12,0.55)_0%,rgba(29,51,119,0.55)_2%)] border-2 border-amber-600/80 text-white shadow-[0_0_18px_rgba(220,38,38,0.3),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'bg-gradient-to-b from-red-800/90 to-red-900/90 border-2 border-red-500 text-white shadow-[0_0_18px_rgba(220,38,38,0.3),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : p.type === 'medical'
                      ? 'bg-[linear-gradient(rgba(178,6,6,0.05),rgba(178,6,6,0.05)),linear-gradient(to_bottom,var(--tw-gradient-from),var(--tw-gradient-to))] from-slate-750 to-slate-800 border-2 border-slate-600/80 text-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.2),0_6px_20px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.04)]'
                      : 'bg-gradient-to-b from-slate-750 to-slate-800 border-2 border-slate-600/80 text-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.2),0_6px_20px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.04)]'
                }
              `}
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
              custom={i}
              whileHover={{
                y: -2,
                boxShadow: isSelected
                  ? '0 0 24px rgba(220,38,38,0.4), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                  : '0 2px 6px rgba(0,0,0,0.25), 0 12px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              aria-pressed={selectedTypes.size > 1 ? isSelected : undefined}
              aria-label={`${p.label} emergency`}
            >
              <span aria-hidden="true" className="text-3xl">
                {p.icon}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-center leading-tight">
                {p.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
