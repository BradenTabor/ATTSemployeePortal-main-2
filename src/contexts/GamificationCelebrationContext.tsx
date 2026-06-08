import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { GamificationCelebrationKind, GamificationCelebrationState } from '@/lib/gamification/types';

const initialState: GamificationCelebrationState = {
  show: false,
  kind: 'badge',
  title: '',
  subtitle: '',
};

interface GamificationCelebrationContextValue {
  state: GamificationCelebrationState;
  showFirstLightWelcome: (tierName: string, subLevelLabel: string, lifetimeEarned: number) => void;
  showTierUpCelebration: (tierName: string, subLevelLabel: string) => void;
  showBadgeCelebration: (badgeTitle: string, prestigeTier?: number) => void;
  dismissGamificationCelebration: () => void;
}

const GamificationCelebrationContext =
  createContext<GamificationCelebrationContextValue | null>(null);

export function GamificationCelebrationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GamificationCelebrationState>(initialState);

  const open = useCallback(
    (kind: GamificationCelebrationKind, partial: Omit<GamificationCelebrationState, 'show' | 'kind'>) => {
      setState((prev) => {
        if (prev.show) return prev;
        return { show: true, kind, ...partial };
      });
    },
    [],
  );

  const showFirstLightWelcome = useCallback(
    (tierName: string, subLevelLabel: string, lifetimeEarned: number) => {
      open('first_light', {
        title: lifetimeEarned > 0 ? `You're already ${tierName} ${subLevelLabel}` : 'Welcome to the crew',
        subtitle:
          lifetimeEarned > 0
            ? `${lifetimeEarned} lifetime points earned — your progress is locked in.`
            : 'First Light badge earned. Every safety action counts from here.',
        tierName,
        subLevelLabel,
      });
    },
    [open],
  );

  const showTierUpCelebration = useCallback(
    (tierName: string, subLevelLabel: string) => {
      open('tier_up', {
        title: `${tierName} ${subLevelLabel}`,
        subtitle: 'Major tier unlocked. Keep stacking the wins.',
        tierName,
        subLevelLabel,
      });
    },
    [open],
  );

  const showBadgeCelebration = useCallback(
    (badgeTitle: string, prestigeTier?: number) => {
      open('badge', {
        title: badgeTitle,
        subtitle: prestigeTier ? `Prestige tier ${prestigeTier} earned.` : 'Badge earned.',
        badgeTitle,
        prestigeTier,
      });
    },
    [open],
  );

  const dismissGamificationCelebration = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo(
    () => ({
      state,
      showFirstLightWelcome,
      showTierUpCelebration,
      showBadgeCelebration,
      dismissGamificationCelebration,
    }),
    [
      state,
      showFirstLightWelcome,
      showTierUpCelebration,
      showBadgeCelebration,
      dismissGamificationCelebration,
    ],
  );

  return (
    <GamificationCelebrationContext.Provider value={value}>
      {children}
    </GamificationCelebrationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGamificationCelebration(): GamificationCelebrationContextValue {
  const ctx = useContext(GamificationCelebrationContext);
  if (!ctx) {
    return {
      state: initialState,
      showFirstLightWelcome: () => {},
      showTierUpCelebration: () => {},
      showBadgeCelebration: () => {},
      dismissGamificationCelebration: () => {},
    };
  }
  return ctx;
}
