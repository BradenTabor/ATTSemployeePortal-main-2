import { forwardRef, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { MOBILE_SAFE_TEXTAREA } from '../../lib/styles';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

/**
 * Textarea - Accessible form textarea with proper focus handling
 * 
 * Accessibility features:
 * - Visible focus ring for keyboard navigation
 * - Improved placeholder contrast (50% vs 30%) for readability
 * - Minimum 44px height for touch targets
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          MOBILE_SAFE_TEXTAREA,
          'w-full bg-[#050402]/80 border rounded-2xl px-4 py-3 text-white resize-none',
          // Improved placeholder contrast for accessibility (WCAG)
          'placeholder:text-white/50',
          // Visible focus ring for keyboard navigation (focus-visible only, not mouse clicks)
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030201]',
          'transition-colors duration-200',
          // Minimum touch target height
          'min-h-[44px]',
          error
            ? 'border-red-500/50 focus-visible:ring-red-500/60'
            : 'border-[#f6dcb2]/20 focus-visible:ring-[#f4c979]/60',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

