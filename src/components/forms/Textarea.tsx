import { forwardRef, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

/**
 * Textarea - Accessible form textarea with proper focus handling
 * 
 * Accessibility features:
 * - Visible focus ring for keyboard navigation
 * - Improved placeholder contrast (50% vs 30%) for readability
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full bg-[#050402]/80 border rounded-2xl px-4 py-3 text-white resize-none',
          // Improved placeholder contrast for accessibility (WCAG)
          'placeholder:text-white/50',
          // Visible focus ring for keyboard navigation
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#030201]',
          'transition-colors duration-200',
          error
            ? 'border-red-500/50 focus:ring-red-500/60'
            : 'border-[#f6dcb2]/20 focus:ring-[#f4c979]/60',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

