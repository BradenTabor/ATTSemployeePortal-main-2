import { memo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Calendar, Trophy, Clock, FileText } from 'lucide-react';
import type { GroupedUserReward, UserClaimDetail } from '../../hooks/queries/useAdminRewards';

interface UserRewardsDetailModalProps {
  user: GroupedUserReward | null;
  isOpen: boolean;
  onClose: () => void;
}

// Format date for display
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

// Individual claim row component
const ClaimRow = memo(({ claim, index }: { claim: UserClaimDetail; index: number }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.04, duration: 0.25 }}
    className="group relative flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-[#0f0d0a]/60 to-transparent border border-[#f6dcb2]/10 hover:border-[#f6dcb2]/25 hover:bg-[#0f0d0a]/80 transition-all duration-300"
  >
    {/* Timeline dot */}
    <div className="relative flex-shrink-0 mt-1">
      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#f4c979] to-[#d89d3e] shadow-[0_0_10px_rgba(244,201,121,0.4)]" />
      {/* Connector line (hidden on last item via CSS) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-[#f4c979]/30 to-transparent group-last:hidden" />
    </div>

    {/* Claim details */}
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Announcement title or fallback */}
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-3.5 h-3.5 text-[#f4c979]/70 flex-shrink-0" />
            <p className="text-sm font-medium text-[#fff6dd] truncate">
              {claim.announcement_title || 'Safety Announcement'}
            </p>
          </div>
          
          {/* Timestamp */}
          <div className="flex items-center gap-4 text-xs text-[#c7b696]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              {formatDate(claim.claimed_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {formatTime(claim.claimed_at)}
            </span>
          </div>
        </div>

        {/* Points badge */}
        <div className="flex-shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f4c979]/15 border border-[#f4c979]/30 text-xs font-bold text-[#fef3d1]">
            <Star className="w-3 h-3 text-[#f4c979]" />
            +{claim.points_awarded}
          </span>
        </div>
      </div>
    </div>
  </motion.div>
));

ClaimRow.displayName = 'ClaimRow';

function UserRewardsDetailModalComponent({ user, isOpen, onClose }: UserRewardsDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && user && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
          >
            {/* Ambient glow overlays */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_20%_0%,rgba(247,228,189,0.1),transparent_50%)] opacity-80" />
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_bottom_right,rgba(209,152,57,0.06),transparent_40%)]" />

            {/* Header */}
            <div className="relative flex-shrink-0 p-6 pb-4 border-b border-[#f6dcb2]/15">
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#0f0d0a]/80 border border-[#f6dcb2]/20 flex items-center justify-center text-[#f4c979]/70 hover:text-[#f4c979] hover:border-[#f6dcb2]/40 transition-all duration-200"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              {/* User info */}
              <div className="flex items-center gap-4 pr-10">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] font-bold text-xl shadow-[0_4px_20px_rgba(244,201,121,0.3)]">
                  {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-[#fff6dd] truncate">
                    {user.full_name || 'Unknown User'}
                  </h2>
                  <p className="text-sm text-[#f4c979] truncate">
                    {user.email || 'No email'}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 mt-4">
                {/* Total points */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f4c979]/10 border border-[#f4c979]/25">
                  <Trophy className="w-4 h-4 text-[#f4c979]" />
                  <span className="text-lg font-bold text-[#fef3d1]">{user.total_points}</span>
                  <span className="text-xs text-[#c7b696]">points</span>
                </div>

                {/* Claim count */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0f0d0a]/60 border border-[#f6dcb2]/15">
                  <Star className="w-4 h-4 text-[#f4c979]/70" />
                  <span className="text-sm font-semibold text-[#f0e2c7]">
                    {user.claim_count} {user.claim_count === 1 ? 'claim' : 'claims'}
                  </span>
                </div>
              </div>
            </div>

            {/* Claims list */}
            <div className="relative flex-1 overflow-y-auto p-6 pt-4">
              <h3 className="text-xs uppercase tracking-[0.2em] font-semibold text-[#f4c979]/70 mb-4">
                Claim History
              </h3>

              <div className="space-y-3">
                {user.claims.map((claim, index) => (
                  <ClaimRow key={claim.id} claim={claim} index={index} />
                ))}
              </div>

              {user.claims.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-[#c7b696]">No claims recorded</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="relative flex-shrink-0 p-4 pt-3 border-t border-[#f6dcb2]/10">
              <div className="flex items-center justify-between text-xs text-[#c7b696]">
                <span>
                  First claim: {user.first_claim_at ? formatDate(user.first_claim_at) : '—'}
                </span>
                <span>
                  Latest: {user.last_claim_at ? formatDate(user.last_claim_at) : '—'}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const UserRewardsDetailModal = memo(UserRewardsDetailModalComponent);
export default UserRewardsDetailModal;

