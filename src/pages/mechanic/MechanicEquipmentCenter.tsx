import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { EquipmentInspectionControlCenter } from "../../components/mechanic/EquipmentInspectionControlCenter";
import { Wrench, Shield, Flame } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";

export default function MechanicEquipmentCenter() {
  const { role } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const unauthorized = role && role !== "mechanic" && role !== "admin";

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  if (unauthorized) {
    return (
      <DashboardLayout title="Equipment Inspection Center" pageHeading>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Equipment Inspection Center" pageHeading>
      <div className="w-full min-h-screen bg-gradient-to-br from-[#1a0804] via-[#0f0402] to-[#0a0201]">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
          {/* Premium Glass Header - Ember Theme */}
          <div className="mb-5 md:mb-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div 
                className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                style={{
                  backdropFilter: 'blur(24px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                  background: 'linear-gradient(145deg, rgba(45, 20, 8, 0.6) 0%, rgba(20, 8, 4, 0.5) 50%, rgba(10, 4, 2, 0.4) 100%)',
                  boxShadow: 'inset 0 0 15px rgba(255, 147, 80, 0.08), 0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)' }} />
                <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />
                <div className="absolute top-0 left-0 w-24 h-24 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255, 147, 80, 0.3) 0%, transparent 70%)', filter: 'blur(15px)' }} />
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
                <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-white/[0.1] to-transparent" />
                <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-black/[0.1] to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/[0.15] to-transparent" />

                <div className="relative px-5 py-4 md:px-7 md:py-5">
                  <div className="flex items-center gap-3 mb-3">
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-200">Fleet Ops</span>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a0804]/60 border border-amber-500/20">
                      <Wrench className="w-3 h-3 text-amber-400" />
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-200/70">{role === "admin" ? "ADMIN" : "MECH"}</span>
                    </motion.div>
                  </div>
                  <div className="flex items-center gap-4">
                    <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-amber-400 via-orange-500 to-red-600 origin-top flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(251, 146, 60, 0.4), 0 0 40px rgba(251, 146, 60, 0.2)' }} />
                    <div className="flex-1 min-w-0">
                      {enableAnimations ? (
                        <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-amber-100 to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,146,60,0.3)]">
                          Equipment Center
                        </TextEffect>
                      ) : (
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-amber-100 to-white/90 bg-clip-text text-transparent">Equipment Center</h1>
                      )}
                      <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-1.5 md:mt-2 text-xs sm:text-sm text-amber-200/50 font-medium leading-relaxed max-w-xl">
                        Review inspections and log fixes
                      </motion.p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            className="space-y-4"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <EquipmentInspectionControlCenter />
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
