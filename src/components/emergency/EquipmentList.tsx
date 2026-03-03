import { motion } from 'framer-motion';
import type { EquipmentLocation } from '../../config/emergency/types';
import { EQUIPMENT_LABELS } from '../../lib/emergency';

interface EquipmentListProps {
  equipment: EquipmentLocation[];
}

const EQUIPMENT_ICONS: Record<string, string> = {
  AED: '🫀',
  'first-aid-kit': '🩹',
  'fire-extinguisher-abc': '🧯',
  'fire-extinguisher-co2': '🧯',
  'eyewash-station': '👁️',
  'emergency-shower': '🚿',
  'spill-kit': '🧪',
};

const EQUIPMENT_COLORS: Record<string, string> = {
  AED: 'border-l-red-500',
  'first-aid-kit': 'border-l-emerald-500',
  'fire-extinguisher-abc': 'border-l-orange-500',
  'fire-extinguisher-co2': 'border-l-orange-500',
  'eyewash-station': 'border-l-sky-500',
  'emergency-shower': 'border-l-sky-500',
  'spill-kit': 'border-l-amber-500',
};

const CARD_SHADOW = 'shadow-[0_1px_3px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]';

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

export default function EquipmentList({ equipment }: EquipmentListProps) {
  const byType = equipment.reduce<Record<string, EquipmentLocation[]>>((acc, item) => {
    const key = item.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const typeOrder = [
    'AED',
    'first-aid-kit',
    'fire-extinguisher-abc',
    'fire-extinguisher-co2',
    'eyewash-station',
    'emergency-shower',
    'spill-kit',
  ];

  let visibleIndex = 0;

  return (
    <section
      className="space-y-4"
      aria-labelledby="equipment-heading"
      role="region"
    >
      <h2 id="equipment-heading" className="text-xl font-bold text-white">
        Equipment locations
      </h2>
      <div className="space-y-3">
        {typeOrder.map((type) => {
          const items = byType[type];
          if (!items || items.length === 0) return null;
          const label = EQUIPMENT_LABELS[type as keyof typeof EQUIPMENT_LABELS] ?? type;
          const icon = EQUIPMENT_ICONS[type] ?? '📦';
          const borderColor = EQUIPMENT_COLORS[type] ?? 'border-l-slate-500';
          const idx = visibleIndex++;

          return (
            <motion.div
              key={type}
              className={`bg-[linear-gradient(180deg,rgba(110,110,110,1)_0%,rgba(114,72,23,0.75)_27%,rgba(35,24,6,0.65)_72%,rgba(4,3,1,0.9)_100%)] border border-slate-700/80 border-l-4 ${borderColor} rounded-xl p-5 ${CARD_SHADOW} equipment-section`}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-30px' }}
              custom={idx}
              whileHover={{
                y: -2,
                boxShadow: '0 2px 6px rgba(0,0,0,0.3), 0 14px 36px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <span aria-hidden="true" className="text-base">{icon}</span>
                {label}
              </h3>
              <ul className="space-y-1.5 text-sm">
                {items.map((item, i) => (
                  <li key={i} className="text-slate-300 flex items-start gap-2">
                    <span className="text-slate-600 select-none mt-0.5" aria-hidden="true">•</span>
                    <span>
                      <span className="text-white">{item.location}</span>
                      {item.floor && <span className="text-slate-400"> — {item.floor}</span>}
                      {item.notes && <span className="text-slate-500"> ({item.notes})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
