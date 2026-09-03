/**
 * AppUpdatePrompt — the only UI for "a new version is available".
 *
 * Two presentations driven by `useAppUpdate()`:
 *   - Banner (default): compact, non-blocking card anchored above the bottom
 *     nav on phones and bottom-right on desktop. Shows download progress, the
 *     auto-apply countdown, "waiting for pending submissions", or failure with
 *     manual controls. Never prevents sign-in or form work.
 *   - Blocking overlay: only when the running build can no longer load its own
 *     chunks (stale deploy). The app is broken at that point, so we take over the
 *     screen while the new worker activates, and offer Reload / Reset if it fails.
 */

import { memo, useEffect, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, DownloadCloud, Loader2, RefreshCw, RotateCcw, Sparkles, UploadCloud } from 'lucide-react';
import { useAppUpdate, type UseAppUpdateResult } from '@/hooks/useAppUpdate';
import { DEFAULT_APP_UPDATE_CONFIG, type AppliedUpdate } from '@/lib/appUpdate';
import { APP_VERSION } from '@/lib/appVersion';
import { glass } from '@/lib/glass';
import { Z } from '@/lib/zIndex';

const BANNER_TRANSITION = { duration: 0.2, ease: 'easeOut' } as const;
const COUNTDOWN_TOTAL_SECONDS = Math.ceil(DEFAULT_APP_UPDATE_CONFIG.countdownMs / 1000);
const APPLIED_PILL_MS = 4500;

function AppUpdatePromptComponent() {
  const update = useAppUpdate();
  const { appliedUpdate, acknowledgeApplied } = update;
  const shouldReduce = useReducedMotion();

  // The "Updated" pill is rendered here (not via the global toaster) so it
  // cannot be lost to mount-order races on the very first frame after a reload.
  useEffect(() => {
    if (!appliedUpdate) return;
    const timer = setTimeout(acknowledgeApplied, APPLIED_PILL_MS);
    return () => clearTimeout(timer);
  }, [appliedUpdate, acknowledgeApplied]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {appliedUpdate && <AppliedPill key="applied" applied={appliedUpdate} reduce={!!shouldReduce} onDismiss={acknowledgeApplied} />}
      {update.visible && update.blocking && <BlockingOverlay key="blocking" update={update} reduce={!!shouldReduce} />}
      {update.visible && !update.blocking && <Banner key="banner" update={update} reduce={!!shouldReduce} />}
    </AnimatePresence>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// "Updated" confirmation pill (shown once, right after the reload lands)
// ---------------------------------------------------------------------------

interface AppliedPillProps {
  applied: AppliedUpdate;
  reduce: boolean;
  onDismiss: () => void;
}

function AppliedPill({ applied, reduce, onDismiss }: AppliedPillProps) {
  const label = applied.fromVersion !== applied.toVersion
    ? `Updated to version ${applied.toVersion}`
    : 'ATTS Portal is up to date';

  return (
    // Outer wrapper does the centering; framer-motion owns `transform` on the inner node.
    <div
      className="pointer-events-none fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] flex justify-center"
      style={{ zIndex: Z.toast }}
    >
      <motion.div
        role="status"
        aria-live="polite"
        data-testid="app-update-applied"
        initial={reduce ? false : { opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
        transition={BANNER_TRANSITION}
        className="pointer-events-auto"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`${label}. Dismiss`}
          className="inline-flex min-h-[44px] max-w-[calc(100vw-1.5rem)] items-center gap-2.5 truncate rounded-full border border-emerald-500/30 bg-ink-800 px-4 py-2 text-sm font-medium text-emerald-100 shadow-[0_10px_32px_-8px_rgba(0,0,0,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" aria-hidden="true" />
          {label}
        </button>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

interface PresentationProps {
  update: UseAppUpdateResult;
  reduce: boolean;
}

function Banner({ update, reduce }: PresentationProps) {
  const copy = bannerCopy(update);
  const showActions = update.status === 'ready' || update.status === 'failed';
  const versionLabel = update.targetVersion && update.targetVersion !== APP_VERSION
    ? `${APP_VERSION} → ${update.targetVersion}`
    : `v${APP_VERSION}`;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      data-testid="app-update-banner"
      data-update-status={update.status}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={BANNER_TRANSITION}
      style={{ zIndex: Z.toast }}
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:right-6 md:bottom-6 md:w-[380px]"
    >
      <div className={`${glass.elevated} overflow-hidden`}>
        <div className={`h-0.5 ${copy.accentBar}`} aria-hidden="true" />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border ${copy.iconWrap}`}>
              {copy.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-white">{copy.title}</p>
                <span className="flex-shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/60">
                  {versionLabel}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-white/60">{copy.body}</p>
            </div>
          </div>

          {showActions && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={update.applyNow}
                data-testid="app-update-apply"
                className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-500 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Update now
              </button>
              {update.status === 'failed' ? (
                <button
                  type="button"
                  onClick={update.hardReset}
                  data-testid="app-update-reset"
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reset app
                </button>
              ) : (
                <button
                  type="button"
                  onClick={update.snooze}
                  data-testid="app-update-later"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  Later
                </button>
              )}
            </div>
          )}

          {update.countdownSecondsLeft !== null && update.status === 'ready' && (
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-300 ease-linear"
                style={{ width: `${Math.min(100, (update.countdownSecondsLeft / COUNTDOWN_TOTAL_SECONDS) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface BannerCopy {
  title: string;
  body: string;
  icon: ReactElement;
  iconWrap: string;
  accentBar: string;
}

function bannerCopy(update: UseAppUpdateResult): BannerCopy {
  const emerald = {
    iconWrap: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    accentBar: 'bg-gradient-to-r from-emerald-500/0 via-emerald-400 to-emerald-500/0',
  };
  const amber = {
    iconWrap: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    accentBar: 'bg-gradient-to-r from-amber-500/0 via-amber-400 to-amber-500/0',
  };
  const red = {
    iconWrap: 'border-red-500/30 bg-red-500/10 text-red-400',
    accentBar: 'bg-gradient-to-r from-red-500/0 via-red-400 to-red-500/0',
  };

  switch (update.status) {
    case 'downloading':
      return {
        title: 'Getting the latest version',
        body: 'Downloading in the background. You can keep working.',
        icon: <DownloadCloud className="h-5 w-5 animate-pulse" aria-hidden="true" />,
        ...emerald,
      };
    case 'applying':
      return {
        title: 'Installing update',
        body: 'The app will refresh in a moment.',
        icon: <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />,
        ...emerald,
      };
    case 'failed':
      return {
        title: 'Update needs a hand',
        body: update.error ?? 'The update could not be applied automatically.',
        icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
        ...red,
      };
    case 'ready': {
      if (update.pendingQueueCount > 0) {
        const n = update.pendingQueueCount;
        return {
          title: 'Update ready',
          body: `Finishing ${n} pending submission${n === 1 ? '' : 's'} first, then the app will refresh.`,
          icon: <UploadCloud className="h-5 w-5" aria-hidden="true" />,
          ...amber,
        };
      }
      if (update.countdownSecondsLeft !== null) {
        return {
          title: `Updating in ${update.countdownSecondsLeft}s`,
          body: 'A new version is ready. Tap Later to keep working for now.',
          icon: <Sparkles className="h-5 w-5" aria-hidden="true" />,
          ...emerald,
        };
      }
      return {
        title: 'Update ready',
        body: "It'll install when you finish what you're doing here.",
        icon: <Sparkles className="h-5 w-5" aria-hidden="true" />,
        ...emerald,
      };
    }
    case 'idle':
      return {
        title: 'Up to date',
        body: '',
        icon: <Sparkles className="h-5 w-5" aria-hidden="true" />,
        ...emerald,
      };
    default: {
      const exhaustive: never = update.status;
      return exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Blocking overlay (stale build cannot load its own chunks)
// ---------------------------------------------------------------------------

function BlockingOverlay({ update, reduce }: PresentationProps) {
  const failed = update.status === 'failed';

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-blocking-title"
      data-testid="app-update-blocking"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={BANNER_TRANSITION}
      style={{ zIndex: Z.modal }}
      className="fixed inset-0 flex items-center justify-center bg-black/85 p-4"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={BANNER_TRANSITION}
        className={`${glass.elevated} w-full max-w-sm overflow-hidden`}
      >
        <div className="h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-400 to-emerald-500/0" aria-hidden="true" />
        <div className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-leaf-sm border border-emerald-500/30 bg-emerald-500/10">
            <img src="/icon-192.png" alt="" className="h-12 w-12 object-contain" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">All Terrain Tree Service</p>
            <h2 id="app-update-blocking-title" className="text-xl font-bold text-white">
              {failed ? 'Update needs a hand' : 'Loading the new version'}
            </h2>
            <p className="text-sm leading-relaxed text-white/60">
              {failed
                ? update.error ?? 'The new version could not be loaded automatically.'
                : 'This version is out of date. The latest one is installing now — this takes a few seconds.'}
            </p>
          </div>

          {failed ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={update.applyNow}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-500 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reload
              </button>
              <button
                type="button"
                onClick={update.hardReset}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset app
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-300/80" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Installing…
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export const AppUpdatePrompt = memo(AppUpdatePromptComponent);
export default AppUpdatePrompt;
