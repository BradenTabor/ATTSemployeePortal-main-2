/**
 * Global manual-awards entry: renders AwardPointsModal when the user can_award_points.
 * Mounted in App so granted non-admins (who cannot reach /admin/rewards) still get access.
 */
import { Gift } from 'lucide-react';
import { AwardPointsModal } from '../admin/manual-awards/AwardPointsModal';
import { useManualAwardsModal } from '../../hooks/useManualAwardsModal';
import { Z } from '../../lib/zIndex';

/** Floating entry for granted non-admins (and admins outside /admin/rewards). */
export function ManualAwardsGlobalEntry() {
  const { canAward, isOpen, initialRecipient, openAwardModal, closeAwardModal } =
    useManualAwardsModal();

  if (!canAward) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => openAwardModal()}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#f4c979] to-[#d89d3e] text-[#2d1c04] font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
        style={{ zIndex: Z.nav }}
        aria-label="Award points to a teammate"
      >
        <Gift className="w-5 h-5" aria-hidden />
        <span className="hidden sm:inline">Award Points</span>
      </button>
      <AwardPointsModal
        isOpen={isOpen}
        onClose={closeAwardModal}
        initialRecipient={initialRecipient}
      />
    </>
  );
}
