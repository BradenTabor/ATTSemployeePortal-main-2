/**
 * Daily safety briefing: status, personalized content, and answer submission.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { queryKeys } from '../lib/queryKeys';
import { getTodayDateString } from '../lib/complianceHelpers';
import { useAuth } from '../contexts/AuthContext';
import { useLatestAnnouncementQuery } from './queries/useAnnouncementsQuery';
import type { Announcement } from './queries/useAnnouncementsQuery';
import {
  isFieldRole,
  getTodaysQuestions,
  type BriefingQuestion,
} from '../config/safetyBriefing';
import { logger } from '../lib/logger';
import { subDays } from 'date-fns';
import { PERSONALIZED_FALLBACK } from '../config/safetyBriefing';

export interface SafetyBriefingAnswer {
  id: string;
  user_id: string;
  announcement_id: string;
  briefing_date: string;
  completed_at: string;
}

export interface SafetyBriefingStatusResult {
  mustComplete: boolean;
  isLoading: boolean;
  todayAnnouncement: Announcement | null;
  hasCompletedToday: boolean;
  todayDateString: string;
  questions: BriefingQuestion[];
}

/**
 * Whether the current user must complete the safety briefing today.
 * Uses latest announcement filtered by today (Chicago); completion from safety_briefing_answers.
 */
export function useSafetyBriefingStatus(): SafetyBriefingStatusResult {
  const { user, role } = useAuth();
  const todayDateString = getTodayDateString();

  const { data: latestAnnouncement, isLoading: announcementLoading } = useLatestAnnouncementQuery();

  const todayAnnouncement =
    latestAnnouncement && normalizeDate(latestAnnouncement.date) === todayDateString
      ? latestAnnouncement
      : null;

  const { data: completedRow, isLoading: completionLoading } = useQuery({
    queryKey: queryKeys.safetyBriefing.status(user?.id ?? '', todayDateString),
    queryFn: async (): Promise<SafetyBriefingAnswer | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('safety_briefing_answers')
        .select('id, user_id, announcement_id, briefing_date, completed_at')
        .eq('user_id', user.id)
        .eq('briefing_date', todayDateString)
        .maybeSingle();
      if (error) {
        logger.error('Failed to fetch safety briefing completion', { error });
        throw error;
      }
      return data as SafetyBriefingAnswer | null;
    },
    enabled: !!user?.id,
  });

  const hasCompletedToday = completedRow != null;
  const isLoading = announcementLoading || completionLoading;
  const mustComplete =
    isFieldRole(role) && todayAnnouncement != null && !hasCompletedToday;
  const questions = getTodaysQuestions(todayDateString);

  return {
    mustComplete,
    isLoading,
    todayAnnouncement,
    hasCompletedToday,
    todayDateString,
    questions,
  };
}

function normalizeDate(d: string): string {
  return d.slice(0, 10);
}

export interface PersonalizedSafetyContent {
  title: string;
  body: string;
  isLoading: boolean;
  error: boolean;
}

/**
 * Aggregates JSA, certifications, and optional near-miss data for the personalized dropdown.
 * Falls back to PERSONALIZED_FALLBACK when empty or on error.
 */
export function usePersonalizedSafetyContent(userId: string | undefined): PersonalizedSafetyContent {
  const today = new Date();
  const sevenDaysAgo = subDays(today, 7).toISOString();
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysAgo = subDays(today, 30).toISOString();

  const { data: jsaData, isLoading: jsaLoading, isError: jsaError } = useQuery({
    queryKey: [...queryKeys.safetyBriefing.personalizedContent(userId ?? ''), 'jsa'],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('daily_jsa')
        .select('hazards_present, ppe, weather_conditions')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const todayIso = today.toISOString().slice(0, 10);
  const thirtyDaysIso = thirtyDaysFromNow.toISOString().slice(0, 10);
  const { data: certData, isLoading: certLoading, isError: certError } = useQuery({
    queryKey: [...queryKeys.safetyBriefing.personalizedContent(userId ?? ''), 'certs'],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('certification_records')
        .select('expires_at, certification_type_id')
        .eq('user_id', userId)
        .in('status', ['active', 'written_passed'])
        .gte('expires_at', todayIso)
        .lte('expires_at', thirtyDaysIso)
        .order('expires_at')
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: incidentData, isLoading: incidentLoading, isError: incidentError } = useQuery({
    queryKey: [...queryKeys.safetyBriefing.personalizedContent(userId ?? ''), 'incidents'],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('safety_incidents')
        .select('incident_type, description')
        .eq('reported_by', userId)
        .gte('incident_date', thirtyDaysAgo.slice(0, 10))
        .limit(3);
      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      return data;
    },
    enabled: !!userId,
    retry: false,
  });

  const isLoading = jsaLoading || certLoading || incidentLoading;
  const error = jsaError || certError || incidentError;

  const parts: string[] = [];

  if (jsaData && Array.isArray(jsaData) && jsaData.length > 0) {
    const hazards = new Set<string>();
    const ppe: string[] = [];
    for (const row of jsaData as { hazards_present?: Record<string, unknown>; ppe?: unknown }[]) {
      const hp = row.hazards_present;
      if (hp && typeof hp === 'object') {
        Object.keys(hp).forEach((k) => {
          if (hp[k]) hazards.add(k);
        });
      }
      if (row.ppe && typeof row.ppe === 'object') {
        Object.entries(row.ppe as Record<string, unknown>).forEach(([k, v]) => {
          if (v) ppe.push(k);
        });
      }
    }
    if (hazards.size > 0) parts.push(`Recent hazards you've reported: ${[...hazards].slice(0, 5).join(', ')}.`);
    if (ppe.length > 0) parts.push(`PPE used: ${[...new Set(ppe)].slice(0, 5).join(', ')}.`);
  }

  if (certData && Array.isArray(certData) && certData.length > 0) {
    const first = certData[0] as { expires_at?: string };
    const exp = first.expires_at ? first.expires_at.slice(0, 10) : '';
    parts.push(`You have a certification expiring on ${exp}. Stay current!`);
  }

  if (incidentData && Array.isArray(incidentData) && incidentData.length > 0) {
    parts.push("Recent near-miss reports in your area. Stay vigilant.");
  }

  const body = parts.length > 0 ? parts.join(' ') : PERSONALIZED_FALLBACK.body;
  const title = parts.length > 0 ? 'Personalized safety info' : PERSONALIZED_FALLBACK.title;

  return {
    title,
    body,
    isLoading,
    error: !!error,
  };
}

export interface SubmitBriefingAnswersPayload {
  announcementId: string;
  answers: { question_id: string; selected_option_id: string; category: BriefingQuestion['category'] }[];
}

/**
 * Submits the three question answers and creates the briefing completion record.
 */
export function useSubmitSafetyBriefingAnswers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: SubmitBriefingAnswersPayload) => {
      if (!user?.id) throw new Error('Must be logged in to submit briefing answers');

      const todayDateString = getTodayDateString();

      const { data: answerRow, error: insertAnswerError } = await supabase
        .from('safety_briefing_answers')
        .insert({
          user_id: user.id,
          announcement_id: payload.announcementId,
          briefing_date: todayDateString,
        })
        .select('id')
        .single();

      if (insertAnswerError) {
        if (insertAnswerError.code === '23505') {
          return { alreadyCompleted: true } as const;
        }
        logger.error('Failed to insert safety_briefing_answers', insertAnswerError);
        throw insertAnswerError;
      }

      const briefingAnswerId = (answerRow as { id: string }).id;
      const items = payload.answers.map((a) => ({
        briefing_answer_id: briefingAnswerId,
        question_id: a.question_id,
        selected_option_id: a.selected_option_id,
        category: a.category,
      }));

      const { error: itemsError } = await supabase.from('safety_briefing_answer_items').insert(items);
      if (itemsError) {
        logger.error('Failed to insert safety_briefing_answer_items', itemsError);
        throw itemsError;
      }

      return { alreadyCompleted: false } as const;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.safetyBriefing.status(user?.id ?? '', getTodayDateString()),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.safetyBriefing.all });
    },
  });
}
