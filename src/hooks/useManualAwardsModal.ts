import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCanAwardPoints } from './queries/useManualAwards';
import type { AwardRecipient } from '../components/admin/manual-awards/AwardRecipientPicker';

/** Hook for pages that need an "Award points" button gated on can_award_points. */
export function useManualAwardsModal() {
  const { user } = useAuth();
  const { data: canAward = false, isLoading } = useCanAwardPoints(user?.id);
  const [isOpen, setIsOpen] = useState(false);
  const [initialRecipient, setInitialRecipient] = useState<AwardRecipient | null>(null);

  const openAwardModal = useCallback((recipient?: AwardRecipient | null) => {
    setInitialRecipient(recipient ?? null);
    setIsOpen(true);
  }, []);

  const closeAwardModal = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => setInitialRecipient(null), 200);
  }, []);

  return {
    canAward,
    canAwardLoading: isLoading,
    isOpen,
    initialRecipient,
    openAwardModal,
    closeAwardModal,
  };
}
