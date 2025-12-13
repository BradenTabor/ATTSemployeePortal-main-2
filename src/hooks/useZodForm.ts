import { useForm, UseFormProps, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * Wrapper around useForm that integrates Zod validation
 * Note: Uses 'any' for Zod v4 + react-hook-form resolver compatibility
 */
export function useZodForm<TFormData extends FieldValues>(
  schema: z.ZodType<TFormData>,
  options?: Omit<UseFormProps<TFormData>, 'resolver'>
) {
  return useForm<TFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    mode: 'onBlur', // Validate on blur for better UX
    ...options,
  });
}

