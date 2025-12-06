import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full bg-[#050402]/80 border rounded-2xl px-4 py-3 text-white',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#030201]',
          'appearance-none cursor-pointer',
          'transition-colors duration-200',
          error
            ? 'border-red-500/50 focus:ring-red-500/60'
            : 'border-[#f6dcb2]/20 focus:ring-[#f4c979]/60',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';

