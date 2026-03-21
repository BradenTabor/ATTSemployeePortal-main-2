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
  getTodaysQuestions,
  type BriefingQuestion,
  PERSONALIZED_FALLBACK,
} from '../config/safetyBriefing';
import { logger } from '../lib/logger';
import { subDays } from 'date-fns';

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

  // Read admin-configurable briefing settings.
  // We only need enabled + required_roles here, but useAppSetting requires
  // the full schema. On parse failure it falls back to the provided defaults.
  const { data: briefingSettingsRaw } = useQuery({
    queryKey: [...queryKeys.appSettings.detail('safety_briefing_config'), 'status'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'safety_briefing_config')
        .maybeSingle();
      if (!data?.value || typeof data.value !== 'object') return null;
      return data.value as { enabled?: boolean; required_roles?: string[] };
    },
    staleTime: 60_000,
  });
  const briefingEnabled = briefingSettingsRaw?.enabled ?? true;
  const requiredRoles: string[] = briefingSettingsRaw?.required_roles ?? ['employee', 'foreman', 'general_foreman', 'mechanic'];

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

  const roleRequired = role != null && requiredRoles.includes(role);
  const mustComplete =
    briefingEnabled && roleRequired && todayAnnouncement != null && !hasCompletedToday;
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

export interface FocusItem {
  title: string;
  body: string;
}

/**
 * Structured "Your focus today" items derived from the same data as usePersonalizedSafetyContent.
 * Reuses the same query keys so data is shared. Returns up to 3 focus items (certs, hazards, incidents).
 */
export function usePersonalizedFocusItems(userId: string | undefined): {
  focusItems: FocusItem[];
  isLoading: boolean;
} {
  const today = new Date();
  const sevenDaysAgo = subDays(today, 7).toISOString();
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysAgo = subDays(today, 30).toISOString();
  const todayIso = today.toISOString().slice(0, 10);
  const thirtyDaysIso = thirtyDaysFromNow.toISOString().slice(0, 10);

  const { data: jsaData, isLoading: jsaLoading } = useQuery({
    queryKey: [...queryKeys.safetyBriefing.personalizedContent(userId ?? ''), 'jsa'],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('daily_jsa')
        .select('hazards_present')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: certData, isLoading: certLoading } = useQuery({
    queryKey: [...queryKeys.safetyBriefing.personalizedContent(userId ?? ''), 'certs'],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('certification_records')
        .select('expires_at')
        .eq('user_id', userId)
        .in('status', ['active', 'written_passed'])
        .gte('expires_at', todayIso)
        .lte('expires_at', thirtyDaysIso)
        .order('expires_at')
        .limit(1);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: incidentData, isLoading: incidentLoading } = useQuery({
    queryKey: [...queryKeys.safetyBriefing.personalizedContent(userId ?? ''), 'incidents'],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('safety_incidents')
        .select('incident_type')
        .eq('reported_by', userId)
        .gte('incident_date', thirtyDaysAgo.slice(0, 10))
        .limit(1);
      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      return data;
    },
    enabled: !!userId,
    retry: false,
  });

  const focusItems: FocusItem[] = [];
  if (certData && Array.isArray(certData) && certData.length > 0) {
    const first = certData[0] as { expires_at?: string };
    const exp = first.expires_at ? first.expires_at.slice(0, 10) : '';
    focusItems.push({
      title: 'Certification expiring soon',
      body: `You have a certification expiring on ${exp}. Stay current!`,
    });
  }
  if (jsaData && Array.isArray(jsaData) && jsaData.length > 0) {
    const hazards = new Set<string>();
    for (const row of jsaData as { hazards_present?: Record<string, unknown> }[]) {
      if (row.hazards_present && typeof row.hazards_present === 'object') {
        Object.keys(row.hazards_present).forEach((k) => {
          if (row.hazards_present![k]) hazards.add(k);
        });
      }
    }
    if (hazards.size > 0) {
      focusItems.push({
        title: 'Pay extra attention today',
        body: `You've reported: ${[...hazards].slice(0, 3).join(', ')}. Double-check escape routes and conditions.`,
      });
    }
  }
  if (incidentData && Array.isArray(incidentData) && incidentData.length > 0) {
    focusItems.push({
      title: 'Stay vigilant',
      body: "You've reported a recent incident. Keep watching for hazards and communicate with your crew.",
    });
  }

  return {
    focusItems: focusItems.slice(0, 3),
    isLoading: jsaLoading || certLoading || incidentLoading,
  };
}

/**
 * Consecutive days where an announcement existed and the user completed the briefing.
 * Days with no announcement do not break the streak (weekends, company calendar, etc.).
 * A user with a single completion (today only) gets streak === 1 (first day).
 */
export function useBriefingStreak(userId: string | undefined): {
  streak: number;
  isLoading: boolean;
} {
  const todayDateString = getTodayDateString();
  const ninetyDaysAgo = subDays(new Date(), 90).toISOString().slice(0, 10);

  const { data: announcementDates, isLoading: datesLoading } = useQuery({
    queryKey: queryKeys.safetyBriefing.announcementDates(ninetyDaysAgo),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('date')
        .gte('date', ninetyDaysAgo)
        .order('date', { ascending: false });
      if (error) throw error;
      const set = new Set<string>((data || []).map((r: { date: string }) => r.date.slice(0, 10)));
      return Array.from(set).sort((a, b) => b.localeCompare(a));
    },
  });

  const { data: userCompletionDates, isLoading: completionLoading } = useQuery({
    queryKey: queryKeys.safetyBriefing.streak(userId ?? ''),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('safety_briefing_answers')
        .select('briefing_date')
        .eq('user_id', userId)
        .gte('briefing_date', ninetyDaysAgo)
        .order('briefing_date', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: { briefing_date: string }) => r.briefing_date.slice(0, 10));
    },
    enabled: !!userId,
  });

  const streak = (() => {
    if (!announcementDates?.length || !userCompletionDates) return 0;
    const completionSet = new Set(userCompletionDates);
    let count = 0;
    for (const d of announcementDates) {
      if (d > todayDateString) continue;
      if (!completionSet.has(d)) break;
      count++;
    }
    return count;
  })();

  return {
    streak,
    isLoading: datesLoading || completionLoading,
  };
}

export interface CrewBriefingCompletion {
  crewName: string;
  total: number;
  completed: number;
}

/**
 * For the current user's primary crew, returns how many members completed today's briefing.
 * Uses the first crew membership only (limit 1); users in multiple crews see one crew's completion. v1 scope.
 * Positive framing only. Returns null if user has no crew or no crew members.
 */
export function useCrewBriefingCompletion(
  userId: string | undefined,
  todayDateString: string
): { data: CrewBriefingCompletion | null; isLoading: boolean } {
  const { data: crewMembership, isLoading: crewLoading } = useQuery({
    queryKey: queryKeys.crewMembership.user(userId ?? ''),
    queryFn: async () => {
      if (!userId) return null;
      const { data: memberships, error: memError } = await supabase
        .from('crew_members')
        .select('crew_id')
        .eq('user_id', userId)
        .limit(1);
      if (memError || !memberships?.length) return null;
      const crewId = (memberships[0] as { crew_id: string }).crew_id;
      const { data: crew, error: crewError } = await supabase
        .from('crews')
        .select('name')
        .eq('id', crewId)
        .single();
      if (crewError || !crew) return null;
      const { data: members, error: membersError } = await supabase
        .from('crew_members')
        .select('user_id')
        .eq('crew_id', crewId);
      if (membersError || !members?.length) return null;
      return {
        crewName: (crew as { name: string }).name,
        userIds: (members as { user_id: string }[]).map((m) => m.user_id),
      };
    },
    enabled: !!userId,
  });

  const memberIds = crewMembership?.userIds ?? [];
  const { data: completedCount, isLoading: countLoading } = useQuery({
    queryKey: queryKeys.safetyBriefing.crewCompletion(userId ?? '', todayDateString),
    queryFn: async () => {
      if (!memberIds.length) return 0;
      const { count, error } = await supabase
        .from('safety_briefing_answers')
        .select('*', { count: 'exact', head: true })
        .in('user_id', memberIds)
        .eq('briefing_date', todayDateString);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: memberIds.length > 0,
  });

  const isLoading = crewLoading || countLoading;
  const data: CrewBriefingCompletion | null =
    crewMembership && completedCount !== undefined
      ? {
          crewName: crewMembership.crewName,
          total: memberIds.length,
          completed: completedCount,
        }
      : null;

  return { data, isLoading };
}

export interface BriefingDailySnapshot {
  completions_today: number;
}

/**
 * Company-level snapshot for "Today in the field" (positive framing only).
 * Uses RPC get_briefing_daily_snapshot; no PII.
 */
export function useBriefingDailySnapshot(todayDateString: string): {
  data: BriefingDailySnapshot | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.safetyBriefing.dailySnapshot(todayDateString),
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc('get_briefing_daily_snapshot', {
        p_briefing_date: todayDateString,
      });
      if (error) throw error;
      return result as BriefingDailySnapshot | null;
    },
  });
  return { data: data ?? null, isLoading };
}

export interface SubmitBriefingAnswersPayload {
  announcementId: string;
  answers: { question_id: string; selected_option_id: string; category: BriefingQuestion['category'] }[];
  /** Optional open-ended response (e.g. "What's one thing you'll watch for today?"). Max 200 chars. */
  openEndedResponse?: string | null;
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

      const openEnded = payload.openEndedResponse?.trim().slice(0, 200) || null;
      const { data: answerRow, error: insertAnswerError } = await supabase
        .from('safety_briefing_answers')
        .insert({
          user_id: user.id,
          announcement_id: payload.announcementId,
          briefing_date: todayDateString,
          ...(openEnded ? { open_ended_response: openEnded } : {}),
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
      const today = getTodayDateString();
      queryClient.invalidateQueries({
        queryKey: queryKeys.safetyBriefing.status(user?.id ?? '', today),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.safetyBriefing.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.safetyBriefing.streak(user?.id ?? ''),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.safetyBriefing.crewCompletion(user?.id ?? '', today),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.safetyBriefing.dailySnapshot(today),
      });
    },
  });
}
