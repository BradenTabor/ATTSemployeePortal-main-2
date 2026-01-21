import { Toaster as SonnerToaster } from 'sonner';

/**
 * PremiumToaster - Ultra luxurious toast notifications for ATTS Portal
 * 
 * Features:
 * - Premium glass-morphism with emerald accents
 * - Multi-layer glow system
 * - Animated entrance with spring physics
 * - Custom icons per toast type
 * - Rich visual hierarchy
 */
export function Toaster() {

  return (
    <>
      {/* Inject premium toast styles */}
      <style>{`
        /* ============================================ */
        /* ATTS Premium Toast Styling System           */
        /* ============================================ */
        
        /* Toast container positioning */
        [data-sonner-toaster] {
          --width: 380px;
          --gap: 14px;
          z-index: 999999 !important;
        }
        
        /* Base toast styling */
        [data-sonner-toast] {
          --normal-bg: linear-gradient(
            145deg,
            rgba(4, 35, 22, 0.98) 0%,
            rgba(2, 22, 14, 0.99) 50%,
            rgba(1, 12, 8, 1) 100%
          ) !important;
          --normal-border: rgba(16, 185, 129, 0.35) !important;
          --normal-text: #f0fdf4 !important;
          
          --success-bg: linear-gradient(
            145deg,
            rgba(4, 45, 28, 0.98) 0%,
            rgba(2, 28, 18, 0.99) 50%,
            rgba(1, 15, 10, 1) 100%
          ) !important;
          --success-border: rgba(52, 211, 153, 0.5) !important;
          --success-text: #d1fae5 !important;
          
          --error-bg: linear-gradient(
            145deg,
            rgba(45, 10, 10, 0.98) 0%,
            rgba(28, 5, 5, 0.99) 50%,
            rgba(15, 2, 2, 1) 100%
          ) !important;
          --error-border: rgba(248, 113, 113, 0.5) !important;
          --error-text: #fecaca !important;
          
          --warning-bg: linear-gradient(
            145deg,
            rgba(45, 35, 8, 0.98) 0%,
            rgba(28, 22, 4, 0.99) 50%,
            rgba(18, 14, 2, 1) 100%
          ) !important;
          --warning-border: rgba(251, 191, 36, 0.5) !important;
          --warning-text: #fef3c7 !important;
          
          --info-bg: linear-gradient(
            145deg,
            rgba(8, 30, 45, 0.98) 0%,
            rgba(4, 18, 28, 0.99) 50%,
            rgba(2, 10, 15, 1) 100%
          ) !important;
          --info-border: rgba(96, 165, 250, 0.5) !important;
          --info-text: #dbeafe !important;
          
          font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
          padding: 0 !important;
          border-radius: 20px !important;
          overflow: visible !important;
          box-shadow: none !important;
        }
        
        /* Toast inner wrapper for multi-layer effect */
        [data-sonner-toast] > * {
          position: relative;
          z-index: 1;
        }
        
        /* ============================================ */
        /* SUCCESS Toast                               */
        /* ============================================ */
        [data-sonner-toast][data-type="success"] {
          background: var(--success-bg) !important;
          border: 1.5px solid var(--success-border) !important;
          box-shadow: 
            0 0 0 1px rgba(16, 185, 129, 0.1),
            0 4px 20px -4px rgba(16, 185, 129, 0.35),
            0 8px 40px -8px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1) !important;
        }
        
        [data-sonner-toast][data-type="success"]::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 22px;
          background: linear-gradient(
            135deg,
            rgba(52, 211, 153, 0.4) 0%,
            transparent 40%,
            transparent 60%,
            rgba(16, 185, 129, 0.3) 100%
          );
          opacity: 0.6;
          z-index: -1;
          filter: blur(8px);
          animation: successGlow 3s ease-in-out infinite;
        }
        
        [data-sonner-toast][data-type="success"]::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(52, 211, 153, 0.8) 20%,
            rgba(110, 231, 183, 0.9) 50%,
            rgba(52, 211, 153, 0.8) 80%,
            transparent 100%
          );
          border-radius: 20px 20px 0 0;
        }
        
        @keyframes successGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }
        
        /* ============================================ */
        /* ERROR Toast                                 */
        /* ============================================ */
        [data-sonner-toast][data-type="error"] {
          background: var(--error-bg) !important;
          border: 1.5px solid var(--error-border) !important;
          box-shadow: 
            0 0 0 1px rgba(239, 68, 68, 0.1),
            0 4px 20px -4px rgba(239, 68, 68, 0.35),
            0 8px 40px -8px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1) !important;
        }
        
        [data-sonner-toast][data-type="error"]::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 22px;
          background: linear-gradient(
            135deg,
            rgba(248, 113, 113, 0.4) 0%,
            transparent 40%,
            transparent 60%,
            rgba(239, 68, 68, 0.3) 100%
          );
          opacity: 0.5;
          z-index: -1;
          filter: blur(8px);
          animation: errorPulse 2s ease-in-out infinite;
        }
        
        [data-sonner-toast][data-type="error"]::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(248, 113, 113, 0.8) 20%,
            rgba(252, 165, 165, 0.9) 50%,
            rgba(248, 113, 113, 0.8) 80%,
            transparent 100%
          );
          border-radius: 20px 20px 0 0;
        }
        
        @keyframes errorPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.65; }
        }
        
        /* ============================================ */
        /* WARNING Toast                               */
        /* ============================================ */
        [data-sonner-toast][data-type="warning"] {
          background: var(--warning-bg) !important;
          border: 1.5px solid var(--warning-border) !important;
          box-shadow: 
            0 0 0 1px rgba(251, 191, 36, 0.1),
            0 4px 20px -4px rgba(251, 191, 36, 0.3),
            0 8px 40px -8px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1) !important;
        }
        
        [data-sonner-toast][data-type="warning"]::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 22px;
          background: linear-gradient(
            135deg,
            rgba(251, 191, 36, 0.35) 0%,
            transparent 40%,
            transparent 60%,
            rgba(245, 158, 11, 0.3) 100%
          );
          opacity: 0.5;
          z-index: -1;
          filter: blur(8px);
        }
        
        [data-sonner-toast][data-type="warning"]::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(251, 191, 36, 0.8) 20%,
            rgba(253, 224, 71, 0.9) 50%,
            rgba(251, 191, 36, 0.8) 80%,
            transparent 100%
          );
          border-radius: 20px 20px 0 0;
        }
        
        /* ============================================ */
        /* INFO Toast                                  */
        /* ============================================ */
        [data-sonner-toast][data-type="info"] {
          background: var(--info-bg) !important;
          border: 1.5px solid var(--info-border) !important;
          box-shadow: 
            0 0 0 1px rgba(59, 130, 246, 0.1),
            0 4px 20px -4px rgba(59, 130, 246, 0.3),
            0 8px 40px -8px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1) !important;
        }
        
        [data-sonner-toast][data-type="info"]::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 22px;
          background: linear-gradient(
            135deg,
            rgba(96, 165, 250, 0.35) 0%,
            transparent 40%,
            transparent 60%,
            rgba(59, 130, 246, 0.3) 100%
          );
          opacity: 0.5;
          z-index: -1;
          filter: blur(8px);
        }
        
        [data-sonner-toast][data-type="info"]::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(96, 165, 250, 0.8) 20%,
            rgba(147, 197, 253, 0.9) 50%,
            rgba(96, 165, 250, 0.8) 80%,
            transparent 100%
          );
          border-radius: 20px 20px 0 0;
        }
        
        /* ============================================ */
        /* LOADING Toast                               */
        /* ============================================ */
        [data-sonner-toast][data-type="loading"] {
          background: var(--normal-bg) !important;
          border: 1.5px solid var(--normal-border) !important;
          box-shadow: 
            0 0 0 1px rgba(16, 185, 129, 0.1),
            0 4px 20px -4px rgba(16, 185, 129, 0.25),
            0 8px 40px -8px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
        }
        
        [data-sonner-toast][data-type="loading"]::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(16, 185, 129, 0.6) 50%,
            transparent 100%
          );
          border-radius: 20px 20px 0 0;
          animation: loadingShine 1.5s ease-in-out infinite;
        }
        
        @keyframes loadingShine {
          0% { opacity: 0.3; transform: translateX(-100%); }
          50% { opacity: 1; }
          100% { opacity: 0.3; transform: translateX(100%); }
        }
        
        /* ============================================ */
        /* DEFAULT Toast                               */
        /* ============================================ */
        [data-sonner-toast]:not([data-type]) {
          background: var(--normal-bg) !important;
          border: 1.5px solid var(--normal-border) !important;
          box-shadow: 
            0 0 0 1px rgba(16, 185, 129, 0.1),
            0 4px 20px -4px rgba(16, 185, 129, 0.3),
            0 8px 40px -8px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
        }
        
        [data-sonner-toast]:not([data-type])::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(16, 185, 129, 0.7) 20%,
            rgba(52, 211, 153, 0.9) 50%,
            rgba(16, 185, 129, 0.7) 80%,
            transparent 100%
          );
          border-radius: 20px 20px 0 0;
        }
        
        /* ============================================ */
        /* Content Styling                             */
        /* ============================================ */
        [data-sonner-toast] [data-content] {
          padding: 16px 18px !important;
          display: flex !important;
          align-items: flex-start !important;
          gap: 14px !important;
        }
        
        /* Icon container */
        [data-sonner-toast] [data-icon] {
          flex-shrink: 0 !important;
          width: 24px !important;
          height: 24px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        
        [data-sonner-toast] [data-icon] svg {
          width: 20px !important;
          height: 20px !important;
        }
        
        /* Success icon styling */
        [data-sonner-toast][data-type="success"] [data-icon] svg {
          color: #34d399 !important;
          filter: drop-shadow(0 0 8px rgba(52, 211, 153, 0.5));
        }
        
        /* Error icon styling */
        [data-sonner-toast][data-type="error"] [data-icon] svg {
          color: #f87171 !important;
          filter: drop-shadow(0 0 8px rgba(248, 113, 113, 0.5));
        }
        
        /* Warning icon styling */
        [data-sonner-toast][data-type="warning"] [data-icon] svg {
          color: #fbbf24 !important;
          filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.5));
        }
        
        /* Info icon styling */
        [data-sonner-toast][data-type="info"] [data-icon] svg {
          color: #60a5fa !important;
          filter: drop-shadow(0 0 8px rgba(96, 165, 250, 0.5));
        }
        
        /* Loading spinner */
        [data-sonner-toast][data-type="loading"] [data-icon] svg {
          color: #10b981 !important;
          filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.4));
        }
        
        /* Title styling */
        [data-sonner-toast] [data-title] {
          font-size: 14px !important;
          font-weight: 600 !important;
          letter-spacing: -0.01em !important;
          line-height: 1.4 !important;
          margin-bottom: 2px !important;
        }
        
        [data-sonner-toast][data-type="success"] [data-title] {
          color: #d1fae5 !important;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        
        [data-sonner-toast][data-type="error"] [data-title] {
          color: #fecaca !important;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        
        [data-sonner-toast][data-type="warning"] [data-title] {
          color: #fef3c7 !important;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        
        [data-sonner-toast][data-type="info"] [data-title] {
          color: #dbeafe !important;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        
        [data-sonner-toast]:not([data-type]) [data-title],
        [data-sonner-toast][data-type="loading"] [data-title] {
          color: #ecfdf5 !important;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        
        /* Description styling */
        [data-sonner-toast] [data-description] {
          font-size: 12.5px !important;
          font-weight: 400 !important;
          line-height: 1.45 !important;
          opacity: 0.75 !important;
        }
        
        [data-sonner-toast][data-type="success"] [data-description] {
          color: #a7f3d0 !important;
        }
        
        [data-sonner-toast][data-type="error"] [data-description] {
          color: #fca5a5 !important;
        }
        
        [data-sonner-toast][data-type="warning"] [data-description] {
          color: #fde68a !important;
        }
        
        [data-sonner-toast][data-type="info"] [data-description] {
          color: #93c5fd !important;
        }
        
        [data-sonner-toast]:not([data-type]) [data-description],
        [data-sonner-toast][data-type="loading"] [data-description] {
          color: #6ee7b7 !important;
        }
        
        /* ============================================ */
        /* Close Button                                */
        /* ============================================ */
        [data-sonner-toast] [data-close-button] {
          position: absolute !important;
          top: 8px !important;
          right: 8px !important;
          width: 24px !important;
          height: 24px !important;
          border-radius: 8px !important;
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: rgba(255, 255, 255, 0.5) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          opacity: 0 !important;
        }
        
        [data-sonner-toast]:hover [data-close-button] {
          opacity: 1 !important;
        }
        
        [data-sonner-toast] [data-close-button]:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
          color: rgba(255, 255, 255, 0.8) !important;
        }
        
        [data-sonner-toast] [data-close-button] svg {
          width: 14px !important;
          height: 14px !important;
        }
        
        /* ============================================ */
        /* Action Buttons                              */
        /* ============================================ */
        [data-sonner-toast] [data-button] {
          font-size: 12px !important;
          font-weight: 600 !important;
          padding: 8px 14px !important;
          border-radius: 10px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }
        
        [data-sonner-toast] button[data-button="true"] {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.4) 100%) !important;
          border: 1px solid rgba(52, 211, 153, 0.4) !important;
          color: #a7f3d0 !important;
          box-shadow: 0 2px 8px -2px rgba(16, 185, 129, 0.3) !important;
        }
        
        [data-sonner-toast] button[data-button="true"]:hover {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.45) 0%, rgba(5, 150, 105, 0.55) 100%) !important;
          border-color: rgba(52, 211, 153, 0.6) !important;
          color: #d1fae5 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px -2px rgba(16, 185, 129, 0.4) !important;
        }
        
        [data-sonner-toast] button[data-cancel] {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          color: rgba(255, 255, 255, 0.7) !important;
        }
        
        [data-sonner-toast] button[data-cancel]:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          border-color: rgba(255, 255, 255, 0.25) !important;
          color: rgba(255, 255, 255, 0.9) !important;
        }
        
        /* ============================================ */
        /* Progress Bar                                */
        /* ============================================ */
        [data-sonner-toast] [data-progress] {
          position: absolute !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          height: 3px !important;
          border-radius: 0 0 20px 20px !important;
          overflow: hidden !important;
        }
        
        [data-sonner-toast][data-type="success"] [data-progress] {
          background: rgba(16, 185, 129, 0.15) !important;
        }
        
        [data-sonner-toast][data-type="success"] [data-progress]::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #10b981, #34d399) !important;
          transform-origin: left;
        }
        
        [data-sonner-toast][data-type="error"] [data-progress] {
          background: rgba(239, 68, 68, 0.15) !important;
        }
        
        [data-sonner-toast][data-type="error"] [data-progress]::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #ef4444, #f87171) !important;
          transform-origin: left;
        }
        
        /* ============================================ */
        /* Entrance Animation Override                 */
        /* ============================================ */
        [data-sonner-toast][data-mounted="true"] {
          animation: toastSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
        }
        
        [data-sonner-toast][data-removed="true"] {
          animation: toastSlideOut 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
        }
        
        @keyframes toastSlideIn {
          0% {
            opacity: 0;
            transform: translateX(100%) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        @keyframes toastSlideOut {
          0% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(100%) scale(0.9);
          }
        }
        
        /* ============================================ */
        /* Mobile Responsive                           */
        /* ============================================ */
        @media (max-width: 640px) {
          [data-sonner-toaster] {
            --width: calc(100vw - 32px) !important;
            left: 16px !important;
            right: 16px !important;
            bottom: 16px !important;
          }
          
          [data-sonner-toast] {
            border-radius: 16px !important;
          }
          
          [data-sonner-toast] [data-content] {
            padding: 14px 16px !important;
          }
          
          [data-sonner-toast] [data-title] {
            font-size: 13px !important;
          }
          
          [data-sonner-toast] [data-description] {
            font-size: 12px !important;
          }
          
          [data-sonner-toast]::before,
          [data-sonner-toast]::after {
            border-radius: 18px !important;
          }
          
          [data-sonner-toast]::after {
            border-radius: 16px 16px 0 0 !important;
          }
        }
        
        /* ============================================ */
        /* Reduced Motion                              */
        /* ============================================ */
        @media (prefers-reduced-motion: reduce) {
          [data-sonner-toast]::before {
            animation: none !important;
          }
          
          [data-sonner-toast][data-type="loading"]::after {
            animation: none !important;
            opacity: 0.6 !important;
            transform: none !important;
          }
          
          [data-sonner-toast][data-mounted="true"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          
          [data-sonner-toast][data-removed="true"] {
            animation: toastFadeOut 0.2s ease forwards !important;
          }
          
          @keyframes toastFadeOut {
            to { opacity: 0; }
          }
        }
      `}</style>
      
      <SonnerToaster
        position="bottom-right"
        offset={20}
        gap={12}
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
