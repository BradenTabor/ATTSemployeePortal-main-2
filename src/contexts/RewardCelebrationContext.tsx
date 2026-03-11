/**
 * RewardCelebrationContext
 *
 * Provides a single full-screen reward celebration that can be triggered from
 * any claim source (announcement Collect Points, safety briefing claim, etc.).
 * Double-trigger guard: if overlay is already visible, showRewardCelebration is a no-op.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type RewardCelebrationSource = 'announcement' | 'briefing';

export interface RewardCelebrationState {
  show: boolean;
  points: number;
  source: RewardCelebrationSource;
}

interface RewardCelebrationContextValue {
  state: RewardCelebrationState;
  showRewardCelebration: (points: number, source?: RewardCelebrationSource) => void;
  dismissRewardCelebration: () => void;
}

const initialState: RewardCelebrationState = {
  show: false,
  points: 1,
  source: 'announcement',
};

const RewardCelebrationContext = createContext<RewardCelebrationContextValue | null>(null);

export function RewardCelebrationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RewardCelebrationState>(initialState);

  const showRewardCelebration = useCallback((points: number, source: RewardCelebrationSource = 'announcement') => {
    setState((prev) => {
      if (prev.show) return prev;
      return { show: true, points, source };
    });
  }, []);

  const dismissRewardCelebration = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo<RewardCelebrationContextValue>(
    () => ({
      state,
      showRewardCelebration,
      dismissRewardCelebration,
    }),
    [state, showRewardCelebration, dismissRewardCelebration]
  );

  return (
    <RewardCelebrationContext.Provider value={value}>
      {children}
    </RewardCelebrationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with context; fast-refresh prefers components-only
export function useRewardCelebration(): RewardCelebrationContextValue {
  const ctx = useContext(RewardCelebrationContext);
  if (!ctx) {
    return {
      state: initialState,
      showRewardCelebration: () => {},
      dismissRewardCelebration: () => {},
    };
  }
  return ctx;
}
