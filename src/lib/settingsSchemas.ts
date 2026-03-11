/**
 * Zod schemas for app_settings JSONB values.
 * Used for validation on write (admin page) and defensive parsing on read (consumers).
 */

import { z } from 'zod';

// ─── Shared helpers ──────────────────────────────────────────────────────────

const HourMinuteSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

const BriefingOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const BriefingQuestionSchema = z.object({
  id: z.string().min(1),
  category: z.enum(['tree_safety', 'personal_health', 'announcement']),
  text: z.string().min(1),
  options: z.array(BriefingOptionSchema).min(2),
});

// ─── Safety Announcement Config ──────────────────────────────────────────────

export const SafetyAnnouncementConfigSchema = z.object({
  enabled: z.boolean(),
  schedule_utc_hour: z.number().int().min(0).max(23),
  schedule_utc_minute: z.number().int().min(0).max(59),
  schedule_days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).min(1),
  window_hours: z.number().int().min(1).max(168),
  min_submissions: z.number().int().min(0).max(100),
  body_max_chars: z.number().int().min(50).max(1000),
  body_target_chars: z.number().int().min(50).max(1000),
  summary_max_chars: z.number().int().min(50).max(1000),
  custom_prompt_instructions: z.string().max(2000),
});

export type SafetyAnnouncementConfig = z.infer<typeof SafetyAnnouncementConfigSchema>;

export const ANNOUNCEMENT_DEFAULTS: SafetyAnnouncementConfig = {
  enabled: true,
  schedule_utc_hour: 10,
  schedule_utc_minute: 0,
  schedule_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  window_hours: 48,
  min_submissions: 3,
  body_max_chars: 283,
  body_target_chars: 238,
  summary_max_chars: 240,
  custom_prompt_instructions: '',
};

// ─── Safety Briefing Config ──────────────────────────────────────────────────

export const SafetyBriefingConfigSchema = z.object({
  enabled: z.boolean(),
  required_roles: z.array(z.string().min(1)).min(1),
  reminder_push_utc: HourMinuteSchema,
  reminder_sms_utc: HourMinuteSchema,
  escalation_sms_utc: HourMinuteSchema,
  tree_service_standard_text: z.string(),
  personalized_fallback_text: z.string(),
  safety_tips: z.array(z.string().min(1)),
  questions: z.object({
    tree_safety: z.array(BriefingQuestionSchema).min(1),
    personal_health: z.array(BriefingQuestionSchema).min(1),
    announcement: z.array(BriefingQuestionSchema).min(1),
  }),
});

export type SafetyBriefingConfig = z.infer<typeof SafetyBriefingConfigSchema>;

// ─── Reward Points Config ────────────────────────────────────────────────────

export const RewardPointsConfigSchema = z.object({
  enabled: z.boolean(),
  claim_window_start_hour_central: z.number().int().min(0).max(23),
  claim_window_end_hour_central: z.number().int().min(0).max(23),
  announcement_points: z.number().int().min(0).max(100),
  full_compliance_points: z.number().int().min(0).max(100),
  partial_compliance_points: z.number().int().min(0).max(100),
  streak_bonus_points: z.number().int().min(0).max(100),
  streak_min_days: z.number().int().min(1).max(30).optional().default(5),
  override_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export type RewardPointsConfig = z.infer<typeof RewardPointsConfigSchema>;

export const REWARDS_DEFAULTS: RewardPointsConfig = {
  enabled: true,
  claim_window_start_hour_central: 5,
  claim_window_end_hour_central: 8,
  announcement_points: 1,
  full_compliance_points: 5,
  partial_compliance_points: 2,
  streak_bonus_points: 10,
  streak_min_days: 5,
  override_dates: [],
};

// ─── Schema registry for generic use ─────────────────────────────────────────

export const SETTINGS_SCHEMAS = {
  safety_announcement_config: SafetyAnnouncementConfigSchema,
  safety_briefing_config: SafetyBriefingConfigSchema,
  reward_points_config: RewardPointsConfigSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
