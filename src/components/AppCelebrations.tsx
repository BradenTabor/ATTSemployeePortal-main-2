import { lazy, Suspense, useState } from "react";
import { useRewardCelebration } from "@/contexts/RewardCelebrationContext";
import { useGamificationCelebration } from "@/contexts/GamificationCelebrationContext";

const RewardPointsCelebration = lazy(() =>
  import("@/components/rewards/RewardPointsCelebration").then((m) => ({ default: m.RewardPointsCelebration }))
);
const GamificationCelebration = lazy(() =>
  import("@/components/gamification/GamificationCelebration").then((m) => ({ default: m.GamificationCelebration }))
);

/**
 * Mounts the full-screen celebration overlays only once one has actually been
 * triggered. Keeps ~15 KB of confetti/portal code (plus its framer variants)
 * out of the startup bundle. Once loaded the component stays mounted so the
 * exit animation is not cut short when `show` flips back to false.
 */
export function AppCelebrations() {
  const reward = useRewardCelebration();
  const gamification = useGamificationCelebration();
  // Latches: once a celebration has shown, keep its component mounted.
  const [rewardArmed, setRewardArmed] = useState(false);
  const [gamificationArmed, setGamificationArmed] = useState(false);
  if (reward.state.show && !rewardArmed) setRewardArmed(true);
  if (gamification.state.show && !gamificationArmed) setGamificationArmed(true);

  return (
    <Suspense fallback={null}>
      {rewardArmed && <RewardPointsCelebration />}
      {gamificationArmed && <GamificationCelebration />}
    </Suspense>
  );
}

export default AppCelebrations;
