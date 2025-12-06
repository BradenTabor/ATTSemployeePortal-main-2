import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full bg-[#050402]/80 border rounded-2xl px-4 py-3 text-white',
          'placeholder:text-white/30',
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

Input.displayName = 'Input';

