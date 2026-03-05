/**
 * Phase 3 item 13: Close-call / good-catch prompt on dashboard.
 * "Did you spot anything yesterday worth sharing?" with one-tap link to near-miss form.
 * Field roles only; dismissible for the day (localStorage).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCirclePlus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isFieldRole } from '../../config/safetyBriefing';
import { getTodayDateString } from '../../lib/complianceHelpers';

const DISMISS_KEY_PREFIX = 'good_catch_dismissed_';

function isDismissedToday(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY_PREFIX + getTodayDateString()) === '1';
  } catch {
    return false;
  }
}

export function GoodCatchPrompt() {
  const { role } = useAuth();
  const [dismissed, setDismissed] = useState(isDismissedToday);

  const handleDismiss = () => {
    const today = getTodayDateString();
    try {
      localStorage.setItem(DISMISS_KEY_PREFIX + today, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (!isFieldRole(role)) return null;

  const show = !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="good-catch-prompt"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
          transition={{ duration: 0.2 }}
          className="mb-3 sm:mb-4"
        >
          <div className="rounded-xl border border-white/10 bg-white/10 p-3 sm:p-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-400/20">
              <MessageCirclePlus className="h-4 w-4 text-amber-400/90" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/95">
                Did you spot anything yesterday worth sharing?
              </p>
              <p className="text-xs text-white/60 mt-0.5">
                Near-misses and good catches help us all stay safer.
              </p>
              <Link
                to="/dashboard/forms/near-miss"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] rounded-lg"
              >
                Yes — tell us
              </Link>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss for today"
              className="shrink-0 p-1.5 rounded-lg text-white/50 hover:text-white/70 hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
