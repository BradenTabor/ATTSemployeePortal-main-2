import { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Check, Sparkles, Loader2, Clock } from 'lucide-react';
import { useAnnouncementReward, isRewardEligible } from '../hooks/useAnnouncementRewards';
import { cn } from '../lib/utils';
import { getDeviceCapabilities } from '../lib/mobilePerf';

interface CollectPointsButtonProps {
  announcementId: string;
  author: string | null | undefined;
  className?: string;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Only the latest signal announcement is claimable; when false, button is hidden (Option A) */
  isClaimable?: boolean;
}

/**
 * Premium "Collect Points" button for Safety AI announcements
 * 
 * Features:
 * - Only renders for Safety AI-authored announcements
 * - Animated sparkle effects on hover and claim
 * - Three states: unclaimed, claiming, claimed
 * - Premium emerald gradient design
 */
function CollectPointsButtonComponent({
  announcementId,
  author,
  className,
  compact = false,
  isClaimable = true,
}: CollectPointsButtonProps) {
  const {
    hasClaimed,
    isCheckingClaim,
    isClaiming,
    claimReward,
    isWithinClaimWindow,
    claimWindowMessage,
    timeUntilClaimOpens,
  } = useAnnouncementReward(announcementId);
  const [showCelebration, setShowCelebration] = useState(false);

  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableHeavyAnimations = !caps.prefersReducedMotion && !caps.isMobile && !caps.isLowEnd;

  if (!isRewardEligible(author)) {
    return null;
  }

  if (!isClaimable) {
    return null;
  }

  const handleClaim = () => {
    if (!hasClaimed && !isClaiming && isWithinClaimWindow) {
      claimReward();
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);
    }
  };

  const countdownText =
    timeUntilClaimOpens &&
    (timeUntilClaimOpens.hours > 0
      ? `${timeUntilClaimOpens.hours}h ${timeUntilClaimOpens.minutes}m`
      : `${timeUntilClaimOpens.minutes}m`);
  
  // Loading state while checking claim status
  if (isCheckingClaim) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full bg-verdant-500/10 border border-verdant-400/20",
        compact && "px-3 py-1.5",
        className
      )}>
        <Loader2 className={cn("w-4 h-4 animate-spin text-emerald-400/60", compact && "w-3.5 h-3.5")} />
        <span className={cn("text-xs text-emerald-300/60 font-medium", compact && "text-[10px]")}>Loading...</span>
      </div>
    );
  }
  
  // Claimed state
  if (hasClaimed) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "relative flex items-center gap-2 px-4 py-2 rounded-full border",
          "bg-verdant-500/15 border-verdant-400/30",
          compact && "px-3 py-1.5 gap-1.5",
          className
        )}
      >
        <div className="relative">
          <Check className={cn("w-4 h-4 text-emerald-400", compact && "w-3.5 h-3.5")} />
          {/* Only animate on capable devices */}
          {enableHeavyAnimations && (
            <motion.div
              className="absolute -inset-1 rounded-full bg-emerald-400/20"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
        <span className={cn(
          "font-mono text-[11px] uppercase tracking-[0.14em] text-verdant-200",
          compact && "text-[9px]"
        )}>
          Claimed
        </span>
      </motion.div>
    );
  }
  
  // Unclaimed but outside claim window (5–8 AM Central) — show disabled state and countdown
  if (!hasClaimed && !isWithinClaimWindow) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full border border-bone-50/[0.1] bg-ink-950/60 max-w-full",
          compact && "px-3 py-1.5 gap-1.5",
          className
        )}
        title={claimWindowMessage ?? undefined}
      >
        <Clock className={cn("w-4 h-4 shrink-0 text-bone-400", compact && "w-3.5 h-3.5")} />
        <span className={cn("font-mono text-[11px] uppercase tracking-[0.12em] text-bone-300 leading-tight", compact && "text-[9px]")}>
          {claimWindowMessage}
          {countdownText && (
            <span className="ml-1 font-medium">
              · Claim opens in {countdownText}
            </span>
          )}
        </span>
      </div>
    );
  }

  // Unclaimed state - interactive button (within 5–8 AM window)
  return (
    <div className={cn("relative", className)}>
      {enableHeavyAnimations && (
        <AnimatePresence>
          {showCelebration && (
            <>
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-emerald-400"
                  initial={{ 
                    opacity: 1, 
                    scale: 0,
                    x: 0, 
                    y: 0 
                  }}
                  animate={{ 
                    opacity: 0, 
                    scale: 1,
                    x: Math.cos((i / 8) * Math.PI * 2) * 50,
                    y: Math.sin((i / 8) * Math.PI * 2) * 50,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{
                    left: '50%',
                    top: '50%',
                    marginLeft: -4,
                    marginTop: -4,
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
      )}

      <motion.button
        onClick={handleClaim}
        disabled={isClaiming}
        whileHover={enableHeavyAnimations ? { scale: 1.03 } : undefined}
        whileTap={enableHeavyAnimations ? { scale: 0.97 } : undefined}
        className={cn(
          "group relative flex items-center gap-2 px-5 py-2.5 rounded-full overflow-hidden",
          "border border-bone-50/30 bg-[linear-gradient(135deg,#F4F7F2_0%,#D2FFA3_100%)] text-ink-950",
          "shadow-[0_2px_6px_rgba(0,0,0,0.5),0_18px_36px_-18px_rgba(184,255,122,0.8)]",
          "transition-[box-shadow,transform] duration-500 ease-canopy hover:shadow-glow-lime",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950",
          "disabled:cursor-not-allowed disabled:opacity-70",
          compact && "px-3.5 py-1.5 gap-1.5",
        )}
      >
        {/* Shine effect on hover - CSS only */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-canopy" />
        
        {/* Icon - animation only on capable devices */}
        <div className="relative z-10">
          {isClaiming ? (
            <Loader2 className={cn("w-4 h-4 animate-spin text-ink-950", compact && "w-3.5 h-3.5")} />
          ) : enableHeavyAnimations ? (
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -5, 5, 0],
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: "easeInOut",
                repeatDelay: 3,
              }}
            >
              <Gift className={cn(
                "w-4 h-4 text-ink-950",
                compact && "w-3.5 h-3.5"
              )} />
            </motion.div>
          ) : (
            <Gift className={cn(
              "w-4 h-4 text-ink-950",
              compact && "w-3.5 h-3.5"
            )} />
          )}
        </div>
        
        {/* Text */}
        <span className={cn(
          "relative z-10 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-950 whitespace-nowrap",
          compact && "text-[9px]"
        )}>
          {isClaiming ? 'Claiming...' : 'Collect Points'}
        </span>
        
        {/* Sparkle indicator - animation only on capable devices */}
        {enableHeavyAnimations ? (
          <motion.div
            className="relative z-10"
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          >
            <Sparkles className={cn(
              "w-3.5 h-3.5 text-verdant-700",
              compact && "w-3 h-3"
            )} />
          </motion.div>
        ) : (
          <Sparkles className={cn(
            "w-3.5 h-3.5 text-verdant-700 relative z-10",
            compact && "w-3 h-3"
          )} />
        )}
        
        {/* Pulsing glow effect - only on capable devices */}
        {enableHeavyAnimations && (
          <motion.div
            className="absolute -inset-1 rounded-full pointer-events-none"
            animate={{
              boxShadow: [
                '0 0 20px rgba(184,255,122, 0.25)',
                '0 0 32px rgba(184,255,122, 0.45)',
                '0 0 20px rgba(184,255,122, 0.25)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.button>
      
      {/* Point value indicator - simpler animation */}
      <div
        className={cn(
          "absolute -top-1 -right-1 flex items-center justify-center",
          "w-5 h-5 rounded-full",
          "bg-ink-950 border border-lime-300/60 shadow-[0_0_12px_rgba(184,255,122,0.4)]",
          "font-mono text-[9px] font-semibold text-lime-300",
          compact && "w-4 h-4 text-[8px] -top-0.5 -right-0.5"
        )}
      >
        +1
      </div>
    </div>
  );
}

export const CollectPointsButton = memo(CollectPointsButtonComponent);
export default CollectPointsButton;


