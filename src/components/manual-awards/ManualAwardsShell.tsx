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
        className="group fixed bottom-safe-4 right-4 sm:bottom-safe-6 sm:right-6 flex h-11 min-w-11 items-center justify-center rounded-full border border-verdant-400/25 bg-ink-900 px-3 text-verdant-300 shadow-md transition-colors duration-150 hover:border-verdant-400/50 hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdant-400 motion-reduce:transition-none"
        style={{ zIndex: Z.nav }}
        aria-label="Award points to a teammate"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Gift className="h-5 w-5 shrink-0" aria-hidden />
        <span aria-hidden className="max-w-0 overflow-hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em] opacity-0 transition-[max-width,margin,opacity] duration-150 group-focus-visible:ml-2 group-focus-visible:max-w-20 group-focus-visible:opacity-100 [@media(hover:hover)]:group-hover:ml-2 [@media(hover:hover)]:group-hover:max-w-20 [@media(hover:hover)]:group-hover:opacity-100 motion-reduce:transition-none">Award</span>
      </button>
      <AwardPointsModal
        isOpen={isOpen}
        onClose={closeAwardModal}
        initialRecipient={initialRecipient}
      />
    </>
  );
}
