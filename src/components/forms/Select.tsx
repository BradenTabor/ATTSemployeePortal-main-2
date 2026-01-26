import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

/**
 * Select - Accessible form select with proper focus handling
 * 
 * Accessibility features:
 * - Visible focus ring for keyboard navigation
 * - Minimum 44px height for touch targets
 * - Supports aria-invalid and aria-describedby (set by parent FormField)
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full bg-[#050402]/80 border rounded-2xl px-4 py-3 text-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030201]',
          'appearance-none cursor-pointer',
          'transition-colors duration-200',
          'min-h-[44px]', // Minimum touch target height
          error
            ? 'border-red-500/50 focus-visible:ring-red-500/60'
            : 'border-[#f6dcb2]/20 focus-visible:ring-[#f4c979]/60',
          className
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

