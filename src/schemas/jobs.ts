import { z } from 'zod';
import { nonEmptyString, optionalString, dateStringSchema, uuidSchema } from './common';

// Milestone schema
export const milestoneSchema = z.object({
  title: nonEmptyString('Milestone title'),
  description: optionalString,
  target_date: optionalString,
  is_completed: z.boolean().default(false),
});

export type MilestoneFormData = z.infer<typeof milestoneSchema>;

// Job creation/edit schema
export const jobFormSchema = z
  .object({
    job_name: nonEmptyString('Job name').max(200, 'Job name too long'),
    job_location: optionalString,
    job_description: optionalString,
    job_specs: optionalString,
    start_date: dateStringSchema,
    end_date: dateStringSchema,
    notes: optionalString,
    milestones: z.array(milestoneSchema).default([]),
    crew_member_ids: z.array(uuidSchema).default([]),
  })
  .refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  });

export type JobFormData = z.infer<typeof jobFormSchema>;

// Job status schema
export const jobStatusSchema = z.enum(['active', 'completed', 'paused', 'cancelled']);

export type JobStatus = z.infer<typeof jobStatusSchema>;

// Job filter schema
export const jobFilterSchema = z.object({
  status: jobStatusSchema.optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type JobFilterData = z.infer<typeof jobFilterSchema>;

