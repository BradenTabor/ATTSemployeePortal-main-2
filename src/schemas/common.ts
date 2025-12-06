import { z } from 'zod';

// Reusable schema pieces
export const uuidSchema = z.string().uuid('Invalid UUID format');

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address');

export const dateStringSchema = z
  .string()
  .min(1, 'Date is required')
  .refine((val) => !isNaN(Date.parse(val)), 'Invalid date format');

export const nonEmptyString = (fieldName: string) =>
  z.string().min(1, `${fieldName} is required`).trim();

export const optionalString = z.string().optional().or(z.literal(''));

export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format')
  .optional()
  .or(z.literal(''));

