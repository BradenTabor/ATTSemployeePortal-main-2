import { motion } from 'framer-motion';
import type { SiteInfo } from '../../config/emergency/types';
import type { LiveLocation } from '../../hooks/emergency/useCurrentLocation';

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-700';
const FOCUS_RING_ALT =
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';

const LAYERED_SHADOW_MD = 'shadow-[0_1px_3px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]';
const LAYERED_SHADOW_LG = 'shadow-[0_2px_6px_rgba(0,0,0,0.3),0_12px_36px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.05)]';

interface PanicPathProps {
  site: SiteInfo;
  liveLocation?: LiveLocation | null;
  locationStatus?: 'idle' | 'loading' | 'success' | 'error' | 'denied' | 'unsupported';
  onShowTriage: () => void;
  onShowSupervisor?: () => void;
  onRetryLocation?: () => void;
}

export default function PanicPath({
  site,
  liveLocation,
  locationStatus = 'idle',
  onShowTriage,
  onShowSupervisor,
  onRetryLocation,
}: PanicPathProps) {
  const isLive = liveLocation && locationStatus === 'success';
  const hasLocation = isLive && liveLocation.address;

  return (
    <div className="space-y-5" role="region" aria-label="Emergency quick actions">
      {/* ── 911 BUTTON ── */}
      <motion.a
        href="tel:911"
        className={`
          block w-full py-7 px-6
          bg-[linear-gradient(to_bottom,#ef4444_0%,#dc2626_40%,#b91c1c_100%)]
          text-white text-3xl sm:text-4xl font-extrabold text-center tracking-tight
          rounded-2xl
          min-h-[80px]
          shadow-[0_0_30px_rgba(220,38,38,0.35),0_2px_4px_rgba(0,0,0,0.3),0_8px_24px_rgba(153,27,27,0.4),inset_0_-6px_12px_8px_rgba(0,0,0,0.45),inset_0_-4px_6px_3px_rgba(34,2,2,0.65)]
          transition-shadow duration-200
          ${FOCUS_RING}
        `}
        whileHover={{
          scale: 1.01,
          boxShadow: '0 0 45px rgba(220,38,38,0.5), 0 2px 4px rgba(0,0,0,0.3), 0 12px 32px rgba(153,27,27,0.5)',
        }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        aria-label="Call 911 emergency services immediately"
      >
        <span aria-hidden="true" className="mr-3 text-4xl align-middle">☎️</span>
        CALL 911 NOW
      </motion.a>

      {/* ── LOCATION CARD ── */}
      <div
        className={`bg-[linear-gradient(180deg,rgba(15,8,0,1)_0%,rgba(102,44,5,1)_50%,rgba(23,12,2,1)_100%)] border border-slate-700/80 rounded-2xl overflow-hidden ${LAYERED_SHADOW_LG}`}
        role="region"
        aria-label="Your location for 911 dispatch"
      >
        <div className="bg-gradient-to-r from-red-900/50 via-red-900/30 to-transparent border-b border-red-800/40 px-5 py-2.5">
          <p className="text-red-200 text-sm font-semibold tracking-wide uppercase">
            Tell 911 you are at:
          </p>
        </div>

        <div className="px-5 py-4 text-center space-y-3">
          {hasLocation ? (
            <>
              <p className="text-white text-xl sm:text-2xl font-bold leading-snug">
                {liveLocation.address}
              </p>
              <p className="text-emerald-400 text-xs font-medium">
                <span aria-hidden="true" className="inline-block w-2 h-2 bg-emerald-400 rounded-full mr-1.5 align-middle animate-pulse" />
                Live GPS location
              </p>
              {liveLocation.crossStreets && (
                <p className="text-slate-300 text-sm">Near {liveLocation.crossStreets}</p>
              )}
            </>
          ) : (
            <>
              {locationStatus === 'loading' && (
                <div className="py-2" aria-live="polite">
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                    <span className="inline-block w-4 h-4 border-2 border-slate-500 border-t-slate-300 rounded-full animate-spin" />
                    Getting your location…
                  </div>
                </div>
              )}
              {(locationStatus === 'idle' || locationStatus === 'loading') ? null : (
                <div className="py-2">
                  <p className="text-slate-400 text-sm mb-2">
                    Unable to determine your location.
                  </p>
                  {(locationStatus === 'error' || locationStatus === 'denied') && onRetryLocation && (
                    <button
                      type="button"
                      onClick={onRetryLocation}
                      className="inline-flex items-center gap-1.5 text-red-300 hover:text-red-200 text-sm font-medium underline underline-offset-2 decoration-red-400/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
                    >
                      Try GPS again
                    </button>
                  )}
                  {locationStatus === 'denied' && (
                    <p className="text-slate-500 text-xs mt-2">
                      Location permission was denied. Enable location access in your browser settings.
                    </p>
                  )}
                  {locationStatus === 'unsupported' && (
                    <p className="text-slate-500 text-xs mt-2">
                      GPS is not available on this device. Tell 911 your location verbally.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="bg-gradient-to-b from-red-950/70 to-red-950/50 border border-red-800/30 rounded-xl px-4 py-3 mt-2">
            <p className="text-red-200 text-sm font-medium leading-relaxed">
              &quot;{site.emergencyAccess.instructions}&quot;
            </p>
          </div>
        </div>

        {site.text911Available && (
          <div className="bg-[rgba(10,0,0,0.6)] border-t border-slate-700/60 px-5 py-3">
            <p className="text-slate-300 text-xs leading-relaxed">
              <span aria-hidden="true" className="mr-1.5">💬</span>
              Text-to-911 is available in this area.{' '}
              {hasLocation ? (
                <span className="text-white font-medium">
                  Text &quot;911&quot; with your emergency and location: {liveLocation.address}
                </span>
              ) : (
                <span className="text-white font-medium">
                  Text &quot;911&quot; with your emergency and your current location.
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div className="space-y-3">
        <p className="text-slate-400 text-sm text-center font-medium">
          Need specific emergency procedures?
        </p>
        <motion.button
          type="button"
          onClick={onShowTriage}
          className={`
            block w-full py-4 px-5
            bg-[rgba(132,15,6,0.55)]
            border border-slate-600/80
            text-white text-base font-semibold text-center
            rounded-xl min-h-[52px]
            ${LAYERED_SHADOW_MD}
            transition-colors duration-150
            ${FOCUS_RING_ALT}
          `}
          whileHover={{ y: -1, boxShadow: '0 2px 6px rgba(0,0,0,0.3), 0 14px 40px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)' }}
          whileTap={{ scale: 0.985 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <span aria-hidden="true" className="mr-2 text-lg">🆘</span>
          I&apos;m helping someone — what do I do?
        </motion.button>
        {onShowSupervisor && (
          <motion.button
            type="button"
            onClick={onShowSupervisor}
            className={`
              block w-full py-4 px-5
              bg-[linear-gradient(180deg,rgba(150,138,3,0.9)_0%,rgba(30,41,59,0)_100%)]
              border border-slate-700/80
              text-slate-200 text-base font-medium text-center
              rounded-xl min-h-[52px]
              ${LAYERED_SHADOW_MD}
              transition-colors duration-150
              ${FOCUS_RING_ALT}
            `}
            whileHover={{ y: -1, boxShadow: '0 2px 6px rgba(0,0,0,0.3), 0 14px 40px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)' }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <span aria-hidden="true" className="mr-2 text-lg">📋</span>
            I&apos;m managing the scene — coordination tools
          </motion.button>
        )}
      </div>
    </div>
  );
}
