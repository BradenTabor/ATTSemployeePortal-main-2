/**
 * Feature Preview Components
 * 
 * Stylized mockup previews of app features for the What's New onboarding.
 * These render inside iPhone mockups to show users what to expect.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Settings,
  Sparkles,
  Bell,
  Camera,
  CreditCard,
  AlertTriangle,
  Users,
  MapPin,
  PenTool,
  Sliders,
  Zap,
  Shield,
  Truck,
  Lock,
  Trophy,
  Star,
  Flame,
  Award,
  Crown,
  Pin,
  Briefcase,
  FileText,
  Megaphone,
  ChevronRight,
} from 'lucide-react';

// Shared animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// ============================================================================
// PROFILE PREVIEW
// ============================================================================

export const ProfilePreview = memo(function ProfilePreview() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full h-full bg-gradient-to-br from-[#030a06] via-[#051810] to-[#020604] p-2 pt-6 overflow-hidden"
    >
      {/* Header with avatar */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 mb-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 border border-emerald-500/40 flex items-center justify-center">
            <User className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border border-[#030a06] flex items-center justify-center">
            <Camera className="w-2 h-2 text-white" />
          </div>
        </div>
        <div>
          <div className="h-3 w-16 bg-white/90 rounded mb-1" />
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[7px] font-bold text-emerald-300">
            EMPLOYEE
          </span>
        </div>
      </motion.div>

      {/* License card */}
      <motion.div
        variants={itemVariants}
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 mb-2"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <CreditCard className="w-3 h-3 text-emerald-400" />
          <span className="text-[9px] font-medium text-white">Driver's License</span>
          <span className="ml-auto px-1 py-0.5 rounded-full bg-emerald-500/20 text-[6px] font-bold text-emerald-300">
            VALID
          </span>
        </div>
        <div className="h-2 w-20 bg-white/20 rounded mb-0.5" />
        <div className="text-[7px] text-emerald-200/60">Expires: Dec 15, 2026</div>
      </motion.div>

      {/* Expiring alert */}
      <motion.div
        variants={itemVariants}
        className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 mb-2"
      >
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span className="text-[9px] font-medium text-white">Medical Card</span>
          <span className="ml-auto px-1 py-0.5 rounded-full bg-amber-500/20 text-[6px] font-bold text-amber-300">
            28 DAYS
          </span>
        </div>
      </motion.div>

      {/* Notification toggle */}
      <motion.div
        variants={itemVariants}
        className="rounded-lg border border-white/10 bg-white/5 p-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bell className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] font-medium text-white">Push Notifications</span>
          </div>
          <div className="w-7 h-4 rounded-full bg-emerald-500 relative">
            <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-white" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ============================================================================
// SETTINGS PREVIEW
// ============================================================================

export const SettingsPreview = memo(function SettingsPreview() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full h-full bg-gradient-to-br from-[#030a06] via-[#051810] to-[#020604] p-2 pt-6 overflow-hidden"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 border border-emerald-500/40 flex items-center justify-center">
          <Settings className="w-4 h-4 text-emerald-400" />
        </div>
        <span className="text-sm font-bold text-white">Settings</span>
      </motion.div>

      {/* Contact Templates */}
      <motion.div
        variants={itemVariants}
        className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 mb-2"
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Users className="w-3 h-3 text-emerald-400" />
          <span className="text-[9px] font-semibold text-white">Contact Templates</span>
          <span className="ml-auto px-1 py-0.5 rounded-full bg-emerald-500/20 text-[6px] font-bold text-emerald-300">
            2
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-white/5">
            <div className="w-1 h-1 rounded-full bg-amber-400" />
            <div className="h-1.5 w-14 bg-white/20 rounded" />
          </div>
          <div className="flex items-center gap-1.5 p-1.5 rounded bg-white/5">
            <div className="w-1 h-1 rounded-full bg-white/30" />
            <div className="h-1.5 w-16 bg-white/20 rounded" />
          </div>
        </div>
      </motion.div>

      {/* Saved Locations */}
      <motion.div
        variants={itemVariants}
        className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 mb-2"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <MapPin className="w-3 h-3 text-emerald-400" />
          <span className="text-[9px] font-semibold text-white">Saved Locations</span>
          <span className="ml-auto px-1 py-0.5 rounded-full bg-emerald-500/20 text-[6px] font-bold text-emerald-300">
            3
          </span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded mb-0.5" />
        <div className="h-1 w-3/4 bg-white/5 rounded" />
      </motion.div>

      {/* Signature */}
      <motion.div
        variants={itemVariants}
        className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 mb-2"
      >
        <div className="flex items-center gap-1.5 mb-1">
          <PenTool className="w-3 h-3 text-emerald-400" />
          <span className="text-[9px] font-semibold text-white">Digital Signature</span>
        </div>
        <div className="h-6 rounded bg-white/5 border border-dashed border-white/20 flex items-center justify-center">
          <div className="h-4 w-14 bg-gradient-to-r from-emerald-400/30 to-emerald-600/20 rounded" />
        </div>
      </motion.div>

      {/* Preferences */}
      <motion.div
        variants={itemVariants}
        className="rounded-lg border border-white/10 bg-white/5 p-2"
      >
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3 h-3 text-emerald-400" />
          <span className="text-[9px] font-semibold text-white">Preferences</span>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ============================================================================
// SMART DEFAULTS PREVIEW
// ============================================================================

export const SmartDefaultsPreview = memo(function SmartDefaultsPreview() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full h-full bg-gradient-to-br from-[#030a06] via-[#051810] to-[#020604] p-2 pt-6 overflow-hidden"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/30 to-purple-700/20 border border-purple-500/40 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <span className="text-[10px] font-bold text-white block">Smart Suggestions</span>
          <span className="text-[7px] text-purple-300/70">AI-powered</span>
        </div>
      </motion.div>

      {/* Suggestion cards */}
      <motion.div variants={itemVariants} className="space-y-1.5 mb-2">
        <div className="flex items-center justify-between p-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10">
          <div className="flex items-center gap-1.5">
            <Truck className="w-3 h-3 text-purple-400" />
            <div>
              <div className="text-[7px] text-white/50">Truck Number</div>
              <div className="text-[9px] font-medium text-white">T-2847</div>
            </div>
          </div>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="px-1.5 py-0.5 rounded bg-purple-500/30 text-[6px] font-bold text-purple-200"
          >
            APPLY
          </motion.div>
        </div>

        <div className="flex items-center justify-between p-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-purple-400" />
            <div>
              <div className="text-[7px] text-white/50">Chipper Number</div>
              <div className="text-[9px] font-medium text-white">C-1592</div>
            </div>
          </div>
          <div className="px-1.5 py-0.5 rounded bg-purple-500/30 text-[6px] font-bold text-purple-200">
            APPLY
          </div>
        </div>

        <div className="flex items-center justify-between p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-emerald-400" />
            <div>
              <div className="text-[7px] text-white/50">Work Location</div>
              <div className="text-[9px] font-medium text-white">Downtown Site</div>
            </div>
          </div>
          <div className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-[6px] font-bold text-emerald-200">
            APPLY
          </div>
        </div>
      </motion.div>

      {/* Apply all button */}
      <motion.div
        variants={itemVariants}
        className="p-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-emerald-500/20 border border-white/10"
      >
        <div className="flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3 text-white" />
          <span className="text-[9px] font-semibold text-white">Apply All Suggestions</span>
        </div>
      </motion.div>

      {/* Privacy note */}
      <motion.div variants={itemVariants} className="mt-2 flex items-center justify-center gap-1">
        <Lock className="w-2 h-2 text-emerald-400/60" />
        <span className="text-[6px] text-emerald-200/40">Contacts never sent to AI</span>
      </motion.div>
    </motion.div>
  );
});

// ============================================================================
// NOTIFICATIONS PREVIEW
// ============================================================================

export const NotificationsPreview = memo(function NotificationsPreview() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full h-full bg-gradient-to-br from-[#030a06] via-[#051810] to-[#020604] p-2 pt-6 overflow-hidden"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/30 to-blue-700/20 border border-blue-500/40 flex items-center justify-center">
          <Bell className="w-4 h-4 text-blue-400" />
        </div>
        <span className="text-sm font-bold text-white">Notifications</span>
      </motion.div>

      {/* Notification items */}
      <motion.div variants={itemVariants} className="space-y-1.5">
        {/* Safety announcement */}
        <div className="p-2 rounded-lg border border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-1.5">
            <div className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-3 h-3 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[7px] font-bold text-red-300">SAFETY ALERT</span>
                <span className="text-[6px] text-white/40">5:00 AM</span>
              </div>
              <div className="h-1.5 w-full bg-white/20 rounded mb-0.5" />
              <div className="h-1 w-3/4 bg-white/10 rounded" />
            </div>
          </div>
        </div>

        {/* Regular notification */}
        <div className="p-2 rounded-lg border border-blue-500/30 bg-blue-500/10">
          <div className="flex items-start gap-1.5">
            <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Bell className="w-3 h-3 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[7px] font-bold text-blue-300">ANNOUNCEMENT</span>
                <span className="text-[6px] text-white/40">Yesterday</span>
              </div>
              <div className="h-1.5 w-full bg-white/15 rounded mb-0.5" />
              <div className="h-1 w-1/2 bg-white/10 rounded" />
            </div>
          </div>
        </div>

        {/* Job update */}
        <div className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
          <div className="flex items-start gap-1.5">
            <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[7px] font-bold text-emerald-300">JOB UPDATE</span>
                <span className="text-[6px] text-white/40">2 days ago</span>
              </div>
              <div className="h-1.5 w-3/4 bg-white/15 rounded" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Enable prompt */}
      <motion.div
        variants={itemVariants}
        className="mt-2 p-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-white/10"
      >
        <div className="flex items-center justify-center gap-1.5">
          <Bell className="w-3 h-3 text-white" />
          <span className="text-[8px] font-medium text-white/70">Enable in Profile</span>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ============================================================================
// REWARDS & GAMIFICATION PREVIEW
// ============================================================================

export const RewardsPreview = memo(function RewardsPreview() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full h-full bg-gradient-to-br from-[#0a0502] via-[#1a0f05] to-[#0a0502] p-2 pt-6 overflow-hidden"
    >
      {/* Header with avatar and XP */}
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/50 flex items-center justify-center">
              <User className="w-5 h-5 text-amber-400" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-[#0a0502] flex items-center justify-center"
            >
              <Crown className="w-2 h-2 text-white" />
            </motion.div>
          </div>
          <div>
            <div className="text-[9px] font-bold text-white flex items-center gap-1">
              Safety Aware
              <Flame className="w-2.5 h-2.5 text-orange-400" />
            </div>
            <div className="text-[7px] text-amber-300/70">7 this week</div>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-600/20 border border-amber-400/40">
          <Star className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-black text-amber-300">11</span>
          <span className="text-[6px] text-amber-400/70">XP</span>
        </div>
      </motion.div>

      {/* Progress bar */}
      <motion.div variants={itemVariants} className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[6px] text-amber-300/60">Safety Aware</span>
          <span className="text-[6px] text-amber-300/60">Safety Pro</span>
        </div>
        <div className="h-2 rounded-full bg-amber-950/50 border border-amber-500/20 overflow-hidden relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '44%' }}
            transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400"
          />
          <Trophy className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 text-amber-200/50" />
        </div>
        <div className="text-[6px] text-center text-amber-300/50 mt-0.5">14 XP to Safety Pro</div>
      </motion.div>

      {/* Collect points button */}
      <motion.div
        variants={itemVariants}
        className="p-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 mb-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] font-bold text-white">Collect Points</span>
          </div>
          <div className="px-1.5 py-0.5 rounded-full bg-amber-500/30 text-[6px] font-bold text-amber-200">
            +1 XP
          </div>
        </div>
      </motion.div>

      {/* Leaderboard preview */}
      <motion.div variants={itemVariants} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Award className="w-3 h-3 text-amber-400" />
          <span className="text-[9px] font-semibold text-white">Leaderboard</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 p-1 rounded bg-amber-500/10">
            <span className="text-[7px] font-bold text-amber-400">1</span>
            <div className="w-3 h-3 rounded-full bg-amber-500/30" />
            <div className="h-1.5 flex-1 bg-white/20 rounded" />
            <Crown className="w-2 h-2 text-amber-400" />
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded bg-white/5">
            <span className="text-[7px] text-white/50">2</span>
            <div className="w-3 h-3 rounded-full bg-white/20" />
            <div className="h-1.5 flex-1 bg-white/10 rounded" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ============================================================================
// QUICK ACCESS PREVIEW
// ============================================================================

export const QuickAccessPreview = memo(function QuickAccessPreview() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full h-full bg-gradient-to-br from-[#030a06] via-[#051810] to-[#020604] p-2 pt-6 overflow-hidden"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/40 flex items-center justify-center">
          <Star className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <span className="text-[10px] font-bold text-white block">Quick Access</span>
          <span className="text-[7px] text-amber-300/70">Your pinned shortcuts</span>
        </div>
        <div className="ml-auto px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[6px] font-bold text-emerald-300">
          3/4
        </div>
      </motion.div>

      {/* Pinned items grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-1 mb-2">
        <div className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1">
          <Briefcase className="w-3 h-3 text-emerald-400" />
          <span className="text-[8px] font-medium text-white">My Jobs</span>
          <ChevronRight className="w-2 h-2 text-white/30 ml-auto" />
        </div>
        <div className="p-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 flex items-center gap-1">
          <FileText className="w-3 h-3 text-blue-400" />
          <span className="text-[8px] font-medium text-white">Forms</span>
          <ChevronRight className="w-2 h-2 text-white/30 ml-auto" />
        </div>
        <div className="p-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 flex items-center gap-1">
          <Megaphone className="w-3 h-3 text-purple-400" />
          <span className="text-[8px] font-medium text-white">News</span>
          <ChevronRight className="w-2 h-2 text-white/30 ml-auto" />
        </div>
        <div className="p-1.5 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 flex items-center justify-center gap-1">
          <Pin className="w-2.5 h-2.5 text-amber-400/60" />
          <span className="text-[7px] text-amber-300/50">Add more</span>
        </div>
      </motion.div>

      {/* Long-press hint */}
      <motion.div
        variants={itemVariants}
        className="p-2 rounded-lg bg-gradient-to-r from-amber-900/30 to-amber-950/20 border border-amber-500/25"
      >
        <div className="flex items-center gap-1.5">
          <Pin className="w-3 h-3 text-amber-400" />
          <div>
            <span className="text-[8px] font-semibold text-amber-300 block">Long-press to pin</span>
            <span className="text-[6px] text-amber-200/50">Or right-click on desktop</span>
          </div>
        </div>
      </motion.div>

      {/* All Tools section preview */}
      <motion.div variants={itemVariants} className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center">
              <Settings className="w-2.5 h-2.5 text-emerald-400" />
            </div>
            <span className="text-[9px] font-semibold text-white">All Tools</span>
          </div>
          <ChevronRight className="w-3 h-3 text-white/30" />
        </div>
      </motion.div>
    </motion.div>
  );
});

// ============================================================================
// PREVIEW SELECTOR
// ============================================================================

export type FeaturePreviewType = 'profile' | 'settings' | 'smart-defaults' | 'notifications' | 'rewards' | 'quick-access';

interface FeaturePreviewProps {
  type: FeaturePreviewType;
}

export const FeaturePreview = memo(function FeaturePreview({ type }: FeaturePreviewProps) {
  switch (type) {
    case 'profile':
      return <ProfilePreview />;
    case 'settings':
      return <SettingsPreview />;
    case 'smart-defaults':
      return <SmartDefaultsPreview />;
    case 'notifications':
      return <NotificationsPreview />;
    case 'rewards':
      return <RewardsPreview />;
    case 'quick-access':
      return <QuickAccessPreview />;
    default:
      return <ProfilePreview />;
  }
});

export default FeaturePreview;
