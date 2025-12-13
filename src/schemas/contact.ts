import { z } from 'zod';
import { emailSchema, nonEmptyString } from './common';

export const contactFormSchema = z.object({
  name: nonEmptyString('Name').max(100),
  email: emailSchema,
  topic: z.enum(['general', 'hr', 'safety', 'payroll', 'it', 'other'], {
    error: 'Please select a topic',
  }),
  message: nonEmptyString('Message').max(2000, 'Message too long'),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

export const contactTopicLabels: Record<ContactFormData['topic'], string> = {
  general: 'General Inquiry',
  hr: 'Human Resources',
  safety: 'Safety & Compliance',
  payroll: 'Payroll & Benefits',
  it: 'IT Support',
  other: 'Other',
};

