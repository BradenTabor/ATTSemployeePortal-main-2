/**
 * CertificationResultOverlay
 *
 * Shows a full-page overlay when a user's certification test has been graded.
 * Automatically displays when the user opens the app after admin review.
 * Accessible: role="dialog", focus trap, Escape to close, prefers-reduced-motion.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Trophy, RefreshCw, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useRecentlyGradedTests } from "../../hooks/useCertifications";
import { getDeviceCapabilities } from "../../lib/mobilePerf";

// Storage key for tracking seen results
const SEEN_RESULTS_KEY = 'atts_seen_test_results';

function getSeenResults(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_RESULTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function markResultSeen(attemptId: string) {
  const seen = getSeenResults();
  if (!seen.includes(attemptId)) {
    seen.push(attemptId);
    // Keep only last 50 entries
    if (seen.length > 50) seen.shift();
    localStorage.setItem(SEEN_RESULTS_KEY, JSON.stringify(seen));
  }
}

interface GradedResult {
  id: string;
  passed: boolean | null;
  score_percentage: number | null;
  correct_answers: number | null;
  total_questions: number | null;
  certification_types:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusable(el: HTMLElement | null): HTMLElement[] {
  if (!el) return [];
  return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
}

const CERT_QUERY_KEY = ['certifications'];

export function CertificationResultOverlay() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: recentlyGraded } = useRecentlyGradedTests(user?.id);
  const [visibleResult, setVisibleResult] = useState<GradedResult | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const caps = getDeviceCapabilities();
  const prefersReducedMotion = caps.prefersReducedMotion;

  useEffect(() => {
    if (!recentlyGraded || recentlyGraded.length === 0) return;

    const seenResults = getSeenResults();
    
    // Find the first unread result
    const unreadResult = recentlyGraded.find(
      (result) => !seenResults.includes(result.id)
    );

    if (unreadResult) {
      const ct = unreadResult.certification_types;
      const certification_types = Array.isArray(ct) ? (ct[0] ?? null) : ct;
      const normalized: GradedResult = {
        id: unreadResult.id,
        passed: unreadResult.passed ?? null,
        score_percentage: unreadResult.score_percentage ?? null,
        correct_answers: unreadResult.correct_answers ?? null,
        total_questions: unreadResult.total_questions ?? null,
        certification_types,
      };
      queueMicrotask(() => setVisibleResult(normalized));
    }
  }, [recentlyGraded]);

  const handleDismiss = useCallback(() => {
    if (!visibleResult) return;
    
    setIsClosing(true);
    markResultSeen(visibleResult.id);
    
    setTimeout(() => {
      previousActiveRef.current?.focus?.();
      setVisibleResult(null);
      setIsClosing(false);
    }, 300);
  }, [visibleResult]);

  const handleViewProfile = useCallback(() => {
    if (visibleResult) {
      markResultSeen(visibleResult.id);
    }
    setVisibleResult(null);
    queryClient.invalidateQueries({ queryKey: CERT_QUERY_KEY });
    navigate('/profile', { state: { scrollToCertifications: true } });
  }, [visibleResult, navigate, queryClient]);

  // Focus trap, Escape. Restore focus only in handleDismiss setTimeout.
  useEffect(() => {
    if (!visibleResult || isClosing) return;

    previousActiveRef.current = (document.activeElement as HTMLElement) ?? null;
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = modalRef.current;
      if (!root?.contains(e.target as Node)) return;
      const focusable = getFocusable(root);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const target = e.target as HTMLElement;
      if (e.shiftKey) {
        if (target === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (target === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, [visibleResult, isClosing, handleDismiss]);

  if (!visibleResult) return null;

  const passed = visibleResult.passed === true;
  const certType = visibleResult.certification_types;
  const certName = (Array.isArray(certType) ? certType[0] : certType)?.name || 'Certification';
  const score = visibleResult.score_percentage?.toFixed(1) || '0';
  const correct = visibleResult.correct_answers || 0;
  const total = visibleResult.total_questions || 0;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-result-dialog-title"
        aria-describedby="cert-result-dialog-desc"
        className={`relative w-full max-w-md ${prefersReducedMotion ? '' : 'transform transition-all duration-300'} ${
          isClosing && !prefersReducedMotion ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <div className={`rounded-2xl border-2 ${
          passed
            ? 'border-emerald-500/60 bg-gradient-to-b from-emerald-950/95 to-neutral-900/98'
            : 'border-red-500/60 bg-gradient-to-b from-red-950/95 to-neutral-900/98'
        } p-6 shadow-2xl backdrop-blur-sm`}>
          {/* Close button */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleDismiss}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>

          {/* Icon */}
          <div className="mb-6 flex justify-center">
            {passed ? (
              <div className="relative">
                {!prefersReducedMotion && (
                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/30" aria-hidden="true" />
                )}
                <div className="relative rounded-full bg-emerald-500/20 p-4">
                  <Trophy className="h-16 w-16 text-emerald-400" aria-hidden />
                </div>
              </div>
            ) : (
              <div className="rounded-full bg-red-500/20 p-4">
                <XCircle className="h-16 w-16 text-red-400" aria-hidden />
              </div>
            )}
          </div>

          {/* Title */}
          <h2 id="cert-result-dialog-title" className={`mb-2 text-center text-2xl font-bold ${
            passed ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {passed ? 'Congratulations!' : 'Not Passed'}
          </h2>
          
          <p className="mb-6 text-center text-gray-300">
            Your <span className="font-semibold text-white">{certName}</span> test has been reviewed
          </p>

          {/* Score + Message (aria-describedby) */}
          <div id="cert-result-dialog-desc">
          {/* Score Card */}
          <div className={`mb-6 rounded-xl ${
            passed ? 'bg-emerald-500/10' : 'bg-red-500/10'
          } p-4 text-center`}>
            <p className={`text-4xl font-bold ${
              passed ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {score}%
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {correct} of {total} questions correct
            </p>
          </div>

          {/* Message */}
          <div className={`mb-6 rounded-lg border ${
            passed ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-amber-950/40 border-amber-500/30'
          } p-3 shadow-md`}>
            {passed ? (
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-300 mt-0.5" aria-hidden />
                <p className="text-sm font-medium text-emerald-200">
                  Your certification is now active! Check your Resources page to view your certifications.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <RefreshCw className="h-5 w-5 flex-shrink-0 text-amber-300 mt-0.5" aria-hidden />
                <p className="text-sm font-medium text-amber-200">
                  You can retake this test after 24 hours. Review the study materials and try again!
                </p>
              </div>
            )}
          </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:shadow-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 min-h-[44px]"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleViewProfile}
              className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                passed 
                  ? 'bg-emerald-600/80 hover:bg-emerald-600 hover:shadow-emerald-500/20'
                  : 'bg-amber-600/80 hover:bg-amber-600 hover:shadow-amber-500/20'
              }`}
            >
              {passed ? 'View Certifications' : 'Study Materials'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
