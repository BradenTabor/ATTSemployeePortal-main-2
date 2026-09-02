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
        className="group fixed bottom-safe-4 right-4 sm:bottom-safe-6 sm:right-6 flex h-12 items-center gap-2.5 rounded-leaf-r-sm border border-bone-50/30 bg-[linear-gradient(135deg,#F4F7F2_0%,#C8FFD4_100%)] px-4 font-semibold text-ink-950 shadow-[0_2px_6px_rgba(0,0,0,0.5),0_18px_36px_-18px_rgba(61,220,132,0.8)] transition-[transform,box-shadow] duration-500 ease-canopy hover:-translate-y-0.5 hover:shadow-glow active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdant-400"
        style={{ zIndex: Z.nav }}
        aria-label="Award points to a teammate"
      >
        <span aria-hidden className="pointer-events-none absolute -inset-1 -z-10 rounded-leaf-r-sm bg-verdant-400/30 blur-md animate-breathe" />
        <Gift className="h-4 w-4 transition-transform duration-500 ease-canopy group-hover:-rotate-12" aria-hidden />
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] sm:inline">Award</span>
      </button>
      <AwardPointsModal
        isOpen={isOpen}
        onClose={closeAwardModal}
        initialRecipient={initialRecipient}
      />
    </>
  );
}
