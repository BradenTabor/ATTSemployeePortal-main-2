import { z } from 'zod';

/**
 * Validates data against a Zod schema and returns typed result
 */
export function validateSchema<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Flatten errors into simple object
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });

  return { success: false, errors };
}

/**
 * Validates Supabase API response data
 */
export function validateApiResponse<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error('API response validation failed:', result.error.flatten());
    throw new Error('Invalid API response format');
  }
  return result.data;
}

/**
 * Creates a partial schema from an existing schema
 * Useful for update operations where all fields are optional
 */
export function createPartialSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  return schema.partial();
}

/**
 * Gets the first error message for a field from a Zod error
 */
export function getFieldError(
  error: z.ZodError | undefined,
  fieldName: string
): string | undefined {
  if (!error) return undefined;
  
  const fieldError = error.errors.find(
    (err) => err.path.join('.') === fieldName
  );
  
  return fieldError?.message;
}

