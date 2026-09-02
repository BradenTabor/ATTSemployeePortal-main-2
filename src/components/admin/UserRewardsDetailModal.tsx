import { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Calendar, Trophy, Clock, FileText, Gift } from 'lucide-react';
import type { GroupedUserReward, UserClaimDetail } from '../../hooks/queries/useAdminRewards';
import { useModalOverlay } from '../../hooks/useModalOverlay';

interface UserRewardsDetailModalProps {
  user: GroupedUserReward | null;
  isOpen: boolean;
  onClose: () => void;
  onAwardPoints?: () => void;
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
    className="group relative flex items-start gap-4 p-4 rounded-leaf-sm bg-gradient-to-r from-[#0B100D]/60 to-transparent border border-[#E4EAE1]/10 hover:border-[#E4EAE1]/25 hover:bg-[#0B100D]/80 transition-all duration-300"
  >
    {/* Timeline dot */}
    <div className="relative flex-shrink-0 mt-1">
      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#F4F7F2] to-[#8DF5A8] shadow-[0_0_10px_rgba(221,255,133,0.4)]" />
      {/* Connector line (hidden on last item via CSS) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-[#F4F7F2]/30 to-transparent group-last:hidden" />
    </div>

    {/* Claim details */}
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Announcement title or fallback */}
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-3.5 h-3.5 text-[#F4F7F2]/70 flex-shrink-0" />
            <p className="text-sm font-medium text-[#F4F7F2] truncate">
              {claim.announcement_title || 'Safety Announcement'}
            </p>
          </div>
          
          {/* Timestamp */}
          <div className="flex items-center gap-4 text-xs text-[#B8C4B6]">
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F4F7F2]/15 border border-[#F4F7F2]/30 text-xs font-bold text-[#F4F7F2]">
            <Star className="w-3 h-3 text-[#F4F7F2]" />
            +{claim.points_awarded}
          </span>
        </div>
      </div>
    </div>
  </motion.div>
));

ClaimRow.displayName = 'ClaimRow';

function UserRewardsDetailModalComponent({ user, isOpen, onClose, onAwardPoints }: UserRewardsDetailModalProps) {
  const { modalRef, zIndex } = useModalOverlay({ isOpen, onClose, zIndex: 100 });

  if (!isOpen || !user) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        style={{ zIndex }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        aria-hidden
      >
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-rewards-detail-modal-title"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-leaf border border-[#E4EAE1]/20 bg-gradient-to-br from-[#121A15] via-[#0B100D] to-[#040605] shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
        >
            {/* Ambient glow overlays */}
            <div className="pointer-events-none absolute inset-0 rounded-leaf bg-[radial-gradient(circle_at_20%_0%,rgba(236,255,174,0.1),transparent_50%)] opacity-80" />
            <div className="pointer-events-none absolute inset-0 rounded-leaf bg-[radial-gradient(circle_at_bottom_right,rgba(174,219,63,0.06),transparent_40%)]" />

            {/* Header */}
            <div className="relative flex-shrink-0 p-6 pb-4 border-b border-[#E4EAE1]/15">
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#0B100D]/80 border border-[#E4EAE1]/20 flex items-center justify-center text-[#F4F7F2]/70 hover:text-[#F4F7F2] hover:border-[#E4EAE1]/40 transition-all duration-200"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              {/* User info */}
              <div className="flex items-center gap-4 pr-10">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-leaf-sm bg-gradient-to-br from-[#F4F7F2] to-[#8DF5A8] flex items-center justify-center text-[#040605] font-bold text-xl shadow-[0_4px_20px_rgba(221,255,133,0.3)]">
                  {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 id="user-rewards-detail-modal-title" className="text-xl font-bold text-[#F4F7F2] truncate">
                    {user.full_name || 'Unknown User'}
                  </h2>
                  <p className="text-sm text-[#F4F7F2] truncate">
                    {user.email || 'No email'}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 mt-4">
                {/* Total points */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F4F7F2]/10 border border-[#F4F7F2]/25">
                  <Trophy className="w-4 h-4 text-[#F4F7F2]" />
                  <span className="text-lg font-bold text-[#F4F7F2]">{user.total_points}</span>
                  <span className="text-xs text-[#B8C4B6]">points</span>
                </div>

                {/* Claim count */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0B100D]/60 border border-[#E4EAE1]/15">
                  <Star className="w-4 h-4 text-[#F4F7F2]/70" />
                  <span className="text-sm font-semibold text-[#D3DCD1]">
                    {user.claim_count} {user.claim_count === 1 ? 'claim' : 'claims'}
                  </span>
                </div>
              </div>
            </div>

            {/* Claims list */}
            <div className="relative flex-1 overflow-y-auto p-6 pt-4">
              <h3 className="text-xs uppercase text-[#F4F7F2]/70 mb-4 font-mono font-medium tracking-[0.14em]">
                Claim History
              </h3>

              <div className="space-y-3">
                {user.claims.map((claim, index) => (
                  <ClaimRow key={claim.id} claim={claim} index={index} />
                ))}
              </div>

              {user.claims.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-[#B8C4B6]">No claims recorded</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="relative flex-shrink-0 p-4 pt-3 border-t border-[#E4EAE1]/10 space-y-3">
              {onAwardPoints && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAwardPoints();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#F4F7F2]/15 border border-[#F4F7F2]/35 text-sm font-semibold text-[#F4F7F2] hover:bg-[#F4F7F2]/25 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <Gift className="w-4 h-4" aria-hidden />
                  Award Points
                </button>
              )}
              <div className="flex items-center justify-between text-xs text-[#B8C4B6]">
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
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

export const UserRewardsDetailModal = memo(UserRewardsDetailModalComponent);
export default UserRewardsDetailModal;


