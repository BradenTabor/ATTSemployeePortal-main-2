/**
 * Emergency Action Plan — Life-safety system for emergencies.
 * Public route (no login required). Triage flow, panic path, site location.
 */

import { useState, useCallback, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../layouts/DashboardLayout';
import config from '../../config/emergency/sampleSiteConfig';
import { mergeProtocols } from '../../lib/emergency';
import PanicPath from '../../components/emergency/PanicPath';
import { useCurrentLocation } from '../../hooks/emergency/useCurrentLocation';
import EmergencyTriage from '../../components/emergency/EmergencyTriage';
import ActionSteps from '../../components/emergency/ActionSteps';
import EmergencyRoles from '../../components/emergency/EmergencyRoles';
import EquipmentList from '../../components/emergency/EquipmentList';
import type { EmergencyType } from '../../config/emergency/types';

import '../../styles/eap-print.css';

type Phase = 'panic' | 'triage' | 'actions' | 'supervisor';

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

export default function EmergencyActionPlan() {
  const [phase, setPhase] = useState<Phase>('panic');
  const [selectedTypes, setSelectedTypes] = useState<Set<EmergencyType>>(new Set());
  const { liveLocation, status: locationStatus, refetch: refetchLocation } = useCurrentLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: scrollRef, offset: ['start start', 'end end'] });
  const accentHue = useTransform(scrollYProgress, [0, 0.5, 1], [340, 350, 15]);
  const accentOpacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0.5, 0.25, 0.15, 0.08]);

  const handleShowTriage = useCallback(() => setPhase('triage'), []);
  const handleShowSupervisor = useCallback(() => setPhase('supervisor'), []);

  const handleToggleType = useCallback((type: EmergencyType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    setPhase((p) => (p === 'triage' ? 'actions' : p));
  }, []);

  const selectedProtocols = config.protocols.filter((p) => selectedTypes.has(p.type));
  const mergedProtocol = mergeProtocols(selectedProtocols);

  return (
    <DashboardLayout title="Emergency Action Plan">
      <div ref={scrollRef} className="relative max-w-2xl mx-auto px-4 py-8 pb-24" data-eap-version={config.metadata.version}>
        {/* Scroll-linked accent glow — subtle warm hue shift as user scrolls */}
        <motion.div
          className="pointer-events-none fixed top-0 left-0 right-0 h-1 z-40 print:hidden"
          style={{
            background: useTransform(
              [accentHue, accentOpacity],
              ([h, o]: number[]) => `linear-gradient(90deg, hsla(${h}, 80%, 50%, ${o}), hsla(${h + 15}, 70%, 45%, ${(o as number) * 0.5}), transparent 80%)`
            ),
          }}
        />

        {/* Skip-link: 911 is first Tab stop */}
        <a
          href="tel:911"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-red-600 focus:text-white focus:p-4 focus:rounded-lg focus:ring-2 focus:ring-white"
          aria-label="Skip to Call 911 emergency services immediately"
        >
          Skip to Call 911
        </a>

        {/* ── PANIC PATH ── */}
        <motion.div
          className="mb-10"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <PanicPath
            site={config.site}
            liveLocation={liveLocation}
            locationStatus={locationStatus}
            onShowTriage={handleShowTriage}
            onShowSupervisor={handleShowSupervisor}
            onRetryLocation={refetchLocation}
          />
        </motion.div>

        {/* ── TRIAGE FLOW ── */}
        <AnimatePresence mode="wait">
          {(phase === 'triage' || phase === 'actions') && (
            <motion.div
              key="triage"
              className="mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const }}
            >
              <EmergencyTriage
                protocols={config.protocols}
                selectedTypes={selectedTypes}
                onToggle={handleToggleType}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ACTION STEPS ── */}
        <AnimatePresence mode="wait">
          {phase === 'actions' && selectedProtocols.length > 0 && (
            <motion.div
              key="action-steps"
              className="mb-10 bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 border border-rose-800/20 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.3),0_12px_40px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const }}
            >
              <ActionSteps protocol={mergedProtocol} config={config} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'actions' && selectedProtocols.length === 0 && (
            <motion.div
              className="mb-10 bg-stone-800/80 border border-stone-700/80 rounded-xl px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.2),0_6px_20px_rgba(0,0,0,0.15)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-stone-400 text-sm">
                Tap an emergency type above to see response steps.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SUPERVISOR PATH ── */}
        <AnimatePresence>
          {phase === 'supervisor' && (
            <motion.div
              className="mb-10 space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="bg-stone-800/80 border border-stone-700/80 rounded-xl px-5 py-4 shadow-md">
                <p className="text-stone-400 text-sm">Coordination tools coming soon.</p>
              </div>
              <EmergencyRoles config={config} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ROLES AND EQUIPMENT ── */}
        <div className="space-y-10 mt-10">
          <div className="border-t border-stone-700/60" />
          <motion.div variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={0}>
            <EmergencyRoles config={config} />
          </motion.div>
          <motion.div variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={1}>
            <EquipmentList equipment={config.equipment} />
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
