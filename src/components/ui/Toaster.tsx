import { Toaster as SonnerToaster } from 'sonner';

/**
 * ATTS Toaster — Centered top toast notifications.
 * High visibility (top-center), solid surfaces, polished entrance animation.
 */
export function Toaster() {
  return (
    <>
      <style>{`
        /* Container — top-center, centered horizontally */
        [data-sonner-toaster][data-x-position="center"] {
          --width: 400px;
          --gap: 12px;
          left: 50% !important;
          right: auto !important;
          transform: translateX(-50%) !important;
          top: 20px !important;
          bottom: auto !important;
          z-index: 999999 !important;
        }

        /* Base: message-style card, more prominent */
        [data-sonner-toast] {
          font-family: inherit !important;
          padding: 0 !important;
          border-radius: 14px !important;
          overflow: hidden !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.4),
            0 10px 32px -8px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        }

        [data-sonner-toast] > * {
          position: relative;
          z-index: 1;
        }

        /* Success — solid green-950 + top highlight */
        [data-sonner-toast][data-type="success"] {
          background: #052e16 !important;
          border-color: rgba(34, 197, 94, 0.3) !important;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.5),
            0 4px 16px rgba(20, 83, 45, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
        }
        [data-sonner-toast][data-type="success"]::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(74, 222, 128, 0.5), transparent);
          pointer-events: none;
        }

        /* Error — solid red-950 */
        [data-sonner-toast][data-type="error"] {
          background: #450a0a !important;
          border-color: rgba(248, 113, 113, 0.3) !important;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.5),
            0 4px 16px rgba(127, 29, 29, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
        }
        [data-sonner-toast][data-type="error"]::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(248, 113, 113, 0.4), transparent);
          pointer-events: none;
        }

        /* Warning */
        [data-sonner-toast][data-type="warning"] {
          background: #422006 !important;
          border-color: rgba(251, 191, 36, 0.3) !important;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.5),
            0 4px 16px rgba(120, 53, 15, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
        }
        [data-sonner-toast][data-type="warning"]::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.4), transparent);
          pointer-events: none;
        }

        /* Info */
        [data-sonner-toast][data-type="info"] {
          background: #0c4a6e !important;
          border-color: rgba(96, 165, 250, 0.3) !important;
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.5),
            0 4px 16px rgba(12, 74, 110, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
        }
        [data-sonner-toast][data-type="info"]::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.4), transparent);
          pointer-events: none;
        }

        /* Loading / default — gray-900 */
        [data-sonner-toast][data-type="loading"],
        [data-sonner-toast]:not([data-type]) {
          background: #111827 !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
        }
        [data-sonner-toast][data-type="loading"]::after,
        [data-sonner-toast]:not([data-type])::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
          pointer-events: none;
        }

        /* Content — roomier for “message” feel */
        [data-sonner-toast] [data-content] {
          padding: 14px 18px 14px 18px !important;
          display: flex !important;
          align-items: center !important;
          gap: 14px !important;
          min-height: 52px !important;
        }

        [data-sonner-toast] [data-icon] {
          flex-shrink: 0 !important;
          width: 20px !important;
          height: 20px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        [data-sonner-toast] [data-icon] svg {
          width: 18px !important;
          height: 18px !important;
        }

        [data-sonner-toast][data-type="success"] [data-icon] svg { color: #4ade80 !important; }
        [data-sonner-toast][data-type="error"] [data-icon] svg { color: #f87171 !important; }
        [data-sonner-toast][data-type="warning"] [data-icon] svg { color: #fbbf24 !important; }
        [data-sonner-toast][data-type="info"] [data-icon] svg { color: #60a5fa !important; }
        [data-sonner-toast][data-type="loading"] [data-icon] svg { color: #34d399 !important; }
        [data-sonner-toast]:not([data-type]) [data-icon] svg { color: rgba(255,255,255,0.7) !important; }

        /* Title — slightly larger for readability */
        [data-sonner-toast] [data-title] {
          font-size: 15px !important;
          font-weight: 600 !important;
          line-height: 1.35 !important;
          color: rgba(255, 255, 255, 0.95) !important;
        }
        [data-sonner-toast][data-type="success"] [data-title] { color: #bbf7d0 !important; }
        [data-sonner-toast][data-type="error"] [data-title] { color: #fecaca !important; }
        [data-sonner-toast][data-type="warning"] [data-title] { color: #fef3c7 !important; }
        [data-sonner-toast][data-type="info"] [data-title] { color: #bfdbfe !important; }

        /* Description */
        [data-sonner-toast] [data-description] {
          font-size: 12px !important;
          font-weight: 400 !important;
          line-height: 1.4 !important;
          color: rgba(255, 255, 255, 0.65) !important;
          margin-top: 2px !important;
        }

        /* Close — always visible, 44px touch target */
        [data-sonner-toast] [data-close-button] {
          position: absolute !important;
          top: 0 !important;
          right: 0 !important;
          width: 44px !important;
          height: 44px !important;
          min-width: 44px !important;
          min-height: 44px !important;
          border-radius: 0 12px 12px 0 !important;
          background: transparent !important;
          border: none !important;
          border-left: 1px solid rgba(255, 255, 255, 0.06) !important;
          color: rgba(255, 255, 255, 0.5) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: color 0.15s ease, background 0.15s ease !important;
          opacity: 1 !important;
        }
        [data-sonner-toast] [data-close-button]:hover {
          background: rgba(255, 255, 255, 0.06) !important;
          color: rgba(255, 255, 255, 0.9) !important;
        }
        [data-sonner-toast] [data-close-button]:focus-visible {
          outline: 2px solid rgba(52, 211, 153, 0.5) !important;
          outline-offset: -2px !important;
        }
        [data-sonner-toast] [data-close-button] svg {
          width: 16px !important;
          height: 16px !important;
        }

        /* Content area leaves room for close button */
        [data-sonner-toast] [data-content] {
          padding-right: 48px !important;
        }

        /* Action / Cancel buttons */
        [data-sonner-toast] [data-button] {
          font-size: 12px !important;
          font-weight: 600 !important;
          padding: 8px 12px !important;
          border-radius: 8px !important;
          transition: background 0.15s ease, border-color 0.15s ease !important;
        }
        [data-sonner-toast] button[data-button="true"] {
          background: rgba(34, 197, 94, 0.2) !important;
          border: 1px solid rgba(74, 222, 128, 0.35) !important;
          color: #86efac !important;
        }
        [data-sonner-toast] button[data-button="true"]:hover {
          background: rgba(34, 197, 94, 0.3) !important;
          border-color: rgba(74, 222, 128, 0.5) !important;
          color: #bbf7d0 !important;
        }
        [data-sonner-toast] button[data-cancel] {
          background: rgba(255, 255, 255, 0.06) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: rgba(255, 255, 255, 0.8) !important;
        }
        [data-sonner-toast] button[data-cancel]:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }

        /* Progress bar */
        [data-sonner-toast] [data-progress] {
          position: absolute !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          height: 2px !important;
          border-radius: 0 0 12px 12px !important;
          overflow: hidden !important;
          background: rgba(255, 255, 255, 0.06) !important;
        }
        [data-sonner-toast][data-type="success"] [data-progress]::after {
          content: '';
          position: absolute;
          inset: 0;
          background: #22c55e !important;
          transform-origin: left;
        }
        [data-sonner-toast][data-type="error"] [data-progress]::after {
          content: '';
          position: absolute;
          inset: 0;
          background: #f87171 !important;
          transform-origin: left;
        }

        /* Entrance — centered drop + scale (top-center) */
        [data-sonner-toast][data-mounted="true"] {
          animation: toastCenterIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
        }
        [data-sonner-toast][data-removed="true"] {
          animation: toastCenterOut 0.22s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
        }
        @keyframes toastCenterIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.94);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes toastCenterOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-12px) scale(0.98);
          }
        }

        /* Mobile — keep top-center, full width with margin */
        @media (max-width: 640px) {
          [data-sonner-toaster][data-x-position="center"] {
            --width: calc(100vw - 24px) !important;
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            top: 12px !important;
          }
          [data-sonner-toast] {
            border-radius: 12px !important;
          }
          [data-sonner-toast] [data-content] {
            padding: 12px 44px 12px 14px !important;
            min-height: 48px !important;
          }
          [data-sonner-toast] [data-close-button] {
            border-radius: 0 12px 12px 0 !important;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          [data-sonner-toast][data-mounted="true"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          [data-sonner-toast][data-removed="true"] {
            animation: toastFadeOut 0.15s ease forwards !important;
          }
          @keyframes toastFadeOut {
            to { opacity: 0; }
          }
        }
      `}</style>
      <SonnerToaster
        position="bottom-right"
        offset={16}
        gap={10}
        visibleToasts={4}
        closeButton
        duration={4500}
        toastOptions={{
          className: 'premium-toast',
        }}
      />
    </>
  );
}
