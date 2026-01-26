import { useForm, UseFormProps, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * Wrapper around useForm that integrates Zod validation
 * 
 * @template TFormData - The form data type inferred from the Zod schema
 * @param schema - Zod schema for form validation
 * @param options - Additional react-hook-form options (resolver is automatically set)
 * @returns Configured useForm hook with Zod validation
 */
export function useZodForm<TFormData extends FieldValues>(
  schema: z.ZodType<TFormData>,
  options?: Omit<UseFormProps<TFormData>, 'resolver'>
) {
  return useForm<TFormData>({
    // @ts-expect-error - zodResolver has complex generic constraints that don't align perfectly
    // with react-hook-form's UseFormProps, but this is safe at runtime
    resolver: zodResolver(schema),
    mode: 'onBlur', // Validate on blur for better UX
    ...options,
  });
}

