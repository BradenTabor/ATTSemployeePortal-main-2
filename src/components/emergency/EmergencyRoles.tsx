import { motion } from 'framer-motion';
import type { EmergencyActionPlanConfig } from '../../config/emergency/types';
import { getTelUri } from '../../lib/emergency';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';

const CARD_SHADOW = 'shadow-[0_1px_3px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]';

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

interface EmergencyRolesProps {
  config: EmergencyActionPlanConfig;
}

function PhoneLink({ phone, name }: { phone: string; name: string }) {
  const tel = getTelUri(phone);
  if (!tel) return <span className="text-slate-400">{phone}</span>;
  return (
    <a
      href={tel}
      className={`
        inline-flex items-center gap-1.5
        text-red-300 hover:text-red-200 font-semibold
        underline underline-offset-2 decoration-red-400/40 hover:decoration-red-300/60
        transition-colors duration-150
        ${FOCUS_RING}
      `}
      aria-label={`Call ${name}`}
    >
      {phone}
    </a>
  );
}

function RoleCard({
  borderColor,
  index,
  children,
}: {
  borderColor: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={`bg-[linear-gradient(180deg,rgba(84,84,84,0.65)_1%,rgba(77,23,5,0.75)_39%,rgba(5,5,5,0.9)_100%)] border border-slate-700/80 border-l-4 ${borderColor} rounded-xl p-5 ${CARD_SHADOW}`}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-30px' }}
      custom={index}
      whileHover={{
        y: -2,
        boxShadow: '0 2px 6px rgba(0,0,0,0.3), 0 14px 36px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}

export default function EmergencyRoles({ config }: EmergencyRolesProps) {
  const { roles } = config;

  return (
    <section
      className="space-y-4"
      aria-labelledby="emergency-roles-heading"
      role="region"
    >
      <h2 id="emergency-roles-heading" className="text-xl font-bold text-white">
        Emergency roles
      </h2>

      <div className="space-y-3">
        <RoleCard borderColor="border-l-red-500" index={0}>
          <h3 className="text-sm font-bold text-[#ff0000] uppercase tracking-wider mb-3">
            Incident Commander
          </h3>
          <div className="space-y-2">
            <p className="text-white text-sm">
              <span className="text-slate-400 text-xs font-medium mr-2">PRIMARY</span>
              {roles.incidentCommander.primary.name}{' '}
              <span className="text-slate-400">({roles.incidentCommander.primary.title})</span>
              {' — '}
              <PhoneLink phone={roles.incidentCommander.primary.phone} name={roles.incidentCommander.primary.name} />
            </p>
            <p className="text-slate-300 text-sm">
              <span className="text-slate-500 text-xs font-medium mr-2">BACKUP</span>
              {roles.incidentCommander.backup.name}
              {' — '}
              <PhoneLink phone={roles.incidentCommander.backup.phone} name={roles.incidentCommander.backup.name} />
            </p>
          </div>
        </RoleCard>

        <RoleCard borderColor="border-l-amber-500" index={1}>
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider mb-3">
            Accountability Officer
          </h3>
          <div className="space-y-2">
            <p className="text-white text-sm">
              <span className="text-slate-400 text-xs font-medium mr-2">PRIMARY</span>
              {roles.accountability.primary.name}{' '}
              <span className="text-slate-400">({roles.accountability.primary.title})</span>
              {' — '}
              <PhoneLink phone={roles.accountability.primary.phone} name={roles.accountability.primary.name} />
            </p>
            <p className="text-slate-300 text-sm">
              <span className="text-slate-500 text-xs font-medium mr-2">BACKUP</span>
              {roles.accountability.backup.name}
              {' — '}
              <PhoneLink phone={roles.accountability.backup.phone} name={roles.accountability.backup.name} />
            </p>
          </div>
        </RoleCard>

        <RoleCard borderColor="border-l-emerald-500" index={2}>
          <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider mb-3">
            First Aid / CPR certified
          </h3>
          <ul className="space-y-2.5">
            {roles.firstAidResponders.map((r) => (
              <li key={r.phone} className="text-sm flex flex-wrap items-baseline gap-x-2">
                <span className="text-white font-medium">{r.name}</span>
                <span className="text-slate-400">—</span>
                <span className="text-slate-300">{r.certification}</span>
                <span className="text-slate-500 text-xs">(exp. {r.certExpiry})</span>
                <span className="text-slate-400">—</span>
                <PhoneLink phone={r.phone} name={r.name} />
              </li>
            ))}
          </ul>
        </RoleCard>

        {roles.offSiteEscalation.length > 0 && (
          <RoleCard borderColor="border-l-sky-500" index={3}>
            <h3 className="text-sm font-bold text-sky-300 uppercase tracking-wider mb-3">
              Off-site escalation
            </h3>
            <ul className="space-y-2.5">
              {roles.offSiteEscalation.map((c) => (
                <li key={c.phone} className="text-sm flex flex-wrap items-baseline gap-x-2">
                  <span className="text-white font-medium">{c.name}</span>
                  <span className="text-slate-400">({c.title})</span>
                  <span className="text-slate-400">—</span>
                  <PhoneLink phone={c.phone} name={c.name} />
                </li>
              ))}
            </ul>
          </RoleCard>
        )}
      </div>
    </section>
  );
}
