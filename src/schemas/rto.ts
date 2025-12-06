import { z } from 'zod';
import { dateStringSchema, nonEmptyString } from './common';

export const rtoRequestSchema = z
  .object({
    start_date: dateStringSchema,
    end_date: dateStringSchema,
    reason: nonEmptyString('Reason').max(500, 'Reason too long'),
  })
  .refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  });

export type RTORequestFormData = z.infer<typeof rtoRequestSchema>;

export const rtoStatusSchema = z.enum(['pending', 'approved', 'denied']);

export type RTOStatus = z.infer<typeof rtoStatusSchema>;

export const rtoAdminActionSchema = z.object({
  requestId: z.string().uuid(),
  action: rtoStatusSchema,
  adminNote: z.string().max(500).optional(),
});

export type RTOAdminActionData = z.infer<typeof rtoAdminActionSchema>;

