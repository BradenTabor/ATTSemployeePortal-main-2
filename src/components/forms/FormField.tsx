import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  error,
  required,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-xs uppercase tracking-[0.3em] text-[#f3d9a4]/70 flex items-center gap-1">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>

      {children}

      {hint && !error && (
        <p className="text-xs text-white/40">{hint}</p>
      )}

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-red-400" />
          {error}
        </p>
      )}
    </div>
  );
}

