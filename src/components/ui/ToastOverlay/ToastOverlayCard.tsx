import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Info, 
  X, 
  ChevronDown, 
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { type ToastState, type ToastType, ANIMATION_DURATION } from './types';

interface ToastOverlayCardProps {
  state: ToastState;
  onDismiss: () => void;
}

// Type-specific styling configurations
const typeConfig: Record<ToastType, {
  icon: typeof CheckCircle2;
  iconClass: string;
  borderClass: string;
  glowClass: string;
  gradientFrom: string;
  gradientTo: string;
  buttonClass: string;
}> = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/40',
    glowClass: 'shadow-emerald-500/20',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-teal-400',
    buttonClass: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-400',
    borderClass: 'border-red-500/40',
    glowClass: 'shadow-red-500/20',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-orange-400',
    buttonClass: 'bg-red-500 hover:bg-red-400 text-white',
  },
  loading: {
    icon: Loader2,
    iconClass: 'text-amber-400 animate-spin',
    borderClass: 'border-amber-500/40',
    glowClass: 'shadow-amber-500/20',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-yellow-400',
    buttonClass: 'bg-amber-500 hover:bg-amber-400 text-amber-950',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-400',
    borderClass: 'border-blue-500/40',
    glowClass: 'shadow-blue-500/20',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-purple-400',
    buttonClass: 'bg-blue-500 hover:bg-blue-400 text-white',
  },
};

export function ToastOverlayCard({ state, onDismiss }: ToastOverlayCardProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  
  const config = typeConfig[state.type];
  const IconComponent = config.icon;
  const isLoading = state.type === 'loading';
  const canDismiss = !state.lockBackground || state.type !== 'loading';

  return (
    <motion.div
      layout
      className={cn(
        'relative overflow-hidden rounded-2xl sm:rounded-3xl',
        'border',
        config.borderClass,
        'shadow-2xl',
        config.glowClass,
      )}
      style={{
        background: 'linear-gradient(145deg, #0c0a07 0%, #0a1a12 50%, #0c0a07 100%)',
        // Safe area padding
        padding: 'max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))',
      }}
      // Accessibility: ARIA live region for screen readers
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Gradient accent line at top */}
      <div 
        className={cn(
          'absolute top-0 left-0 right-0 h-1',
          'bg-gradient-to-r',
          config.gradientFrom,
          config.gradientTo,
        )}
        aria-hidden="true"
      />

      {/* Subtle glow effect behind icon */}
      <div
        className={cn(
          'absolute top-6 left-6 w-16 h-16 rounded-full opacity-30 blur-2xl',
          'bg-gradient-to-br',
          config.gradientFrom,
          config.gradientTo,
        )}
        aria-hidden="true"
      />

      {/* Close button (hidden during loading if locked) */}
      {canDismiss && (
        <button
          onClick={onDismiss}
          className={cn(
            'absolute top-4 right-4 p-2 rounded-xl',
            'text-white/40 hover:text-white hover:bg-white/10',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-white/20',
            'min-w-[44px] min-h-[44px] flex items-center justify-center',
          )}
          aria-label="Dismiss notification"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Main content */}
      <div className="relative flex flex-col items-center text-center pt-2">
        {/* Animated icon */}
        <motion.div
          key={state.type}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            type: 'spring', 
            stiffness: 300, 
            damping: 20,
            duration: ANIMATION_DURATION.stateChange / 1000,
          }}
          className={cn(
            'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl',
            'flex items-center justify-center',
            'bg-gradient-to-br from-white/5 to-white/[0.02]',
            'border border-white/10',
            'mb-5',
          )}
        >
          <IconComponent className={cn('w-8 h-8 sm:w-10 sm:h-10', config.iconClass)} />
        </motion.div>

        {/* Title */}
        <AnimatePresence mode="wait">
          {state.title && (
            <motion.h2
              key={`title-${state.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="text-xl sm:text-2xl font-bold text-white mb-2"
            >
              {state.title}
            </motion.h2>
          )}
        </AnimatePresence>

        {/* Message */}
        <AnimatePresence mode="wait">
          <motion.p
            key={`message-${state.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-base sm:text-lg text-white/70 max-w-sm leading-relaxed"
          >
            {state.message}
          </motion.p>
        </AnimatePresence>

        {/* Expandable details section */}
        {state.details && (
          <div className="w-full mt-4">
            <button
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className={cn(
                'flex items-center justify-center gap-2 w-full py-2',
                'text-sm text-white/50 hover:text-white/70',
                'transition-colors duration-150',
              )}
              aria-expanded={isDetailsExpanded}
            >
              {isDetailsExpanded ? (
                <>Hide Details <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Show Details <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
            <AnimatePresence>
              {isDetailsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-4 rounded-xl bg-black/40 border border-white/5">
                    <pre className="text-xs text-white/60 whitespace-pre-wrap font-mono text-left">
                      {state.details}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full">
          {/* Retry button for errors */}
          {state.type === 'error' && state.onRetry && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={state.onRetry}
              className={cn(
                'flex items-center justify-center gap-2',
                'w-full sm:w-auto px-6 py-3 rounded-xl',
                'font-semibold text-sm',
                'bg-white/10 hover:bg-white/15 text-white',
                'border border-white/10',
                'transition-colors duration-150',
                'min-h-[48px]',
              )}
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </motion.button>
          )}

          {/* Custom actions */}
          {state.actions?.map((action, index) => (
            <motion.button
              key={index}
              whileTap={{ scale: 0.97 }}
              onClick={action.onClick}
              className={cn(
                'flex items-center justify-center gap-2',
                'w-full sm:w-auto px-6 py-3 rounded-xl',
                'font-semibold text-sm',
                'transition-colors duration-150',
                'min-h-[48px]',
                action.variant === 'primary' ? config.buttonClass : 
                action.variant === 'destructive' ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30' :
                'bg-white/10 hover:bg-white/15 text-white border border-white/10',
              )}
            >
              {action.label}
            </motion.button>
          ))}

          {/* Primary dismiss/continue button */}
          {canDismiss && !isLoading && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onDismiss}
              className={cn(
                'flex items-center justify-center gap-2',
                'w-full sm:w-auto px-8 py-3 rounded-xl',
                'font-bold text-sm',
                'transition-all duration-150',
                'min-h-[48px]',
                config.buttonClass,
                'shadow-lg',
              )}
            >
              {state.type === 'success' ? 'Continue' : 
               state.type === 'error' ? 'Close' : 
               'Got It'}
            </motion.button>
          )}

          {/* Loading indicator text */}
          {isLoading && (
            <p className="text-sm text-white/50 animate-pulse">
              Please wait...
            </p>
          )}
        </div>
      </div>

      {/* Screen reader only status announcement */}
      <span className="sr-only">
        {state.type === 'loading' ? 'Loading' : 
         state.type === 'success' ? 'Success' : 
         state.type === 'error' ? 'Error' : 
         'Information'}: {state.title ? `${state.title}. ` : ''}{state.message}
      </span>
    </motion.div>
  );
}
