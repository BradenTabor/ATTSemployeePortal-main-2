import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGamificationCelebration } from '@/contexts/GamificationCelebrationContext';
import { useWelcomeGamification } from '@/hooks/gamification';

const WELCOME_SESSION_KEY = 'atts_gamification_welcome_attempted';

/**
 * Fires welcome_gamification() once per session on dashboard mount.
 * Stamps first_gamification_seen_at, awards First Light, reveals retroactive level.
 */
export function useGamificationWelcomeOnMount() {
  const { user } = useAuth();
  const { mutateAsync } = useWelcomeGamification();
  const { showFirstLightWelcome } = useGamificationCelebration();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || attemptedRef.current) return;

    const sessionKey = `${WELCOME_SESSION_KEY}:${user.id}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) {
      return;
    }

    attemptedRef.current = true;

    void (async () => {
      try {
        const result = await mutateAsync();
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(sessionKey, '1');
        }
        if (result.firstVisit) {
          showFirstLightWelcome(
            result.level.tierName,
            result.level.subLevelLabel,
            result.level.lifetimeEarned,
          );
        }
      } catch {
        attemptedRef.current = false;
      }
    })();
  }, [user?.id, mutateAsync, showFirstLightWelcome]);
}
