/**
 * Push notification functions for leadership alerts
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { RiskScore } from './types.ts';
import { getRiskLevelEmoji } from './utils.ts';

// Leadership roles for push notifications
const LEADERSHIP_ROLES = ['admin', 'general_foreman', 'safety_officer'];

// =============================================================================
// PUSH NOTIFICATIONS
// =============================================================================

export async function sendLeadershipPushNotifications(
  supabase: SupabaseClient,
  riskScore: RiskScore,
  dateFor: string
): Promise<void> {
  // Only notify for ELEVATED+ risk
  if (riskScore.total < 2.0) {
    console.log('[Push] Risk below ELEVATED, skipping notifications');
    return;
  }

  const emoji = getRiskLevelEmoji(riskScore.level);
  const severity = riskScore.level === 'CRITICAL' ? 'critical' 
    : riskScore.level === 'HIGH' ? 'high' 
    : 'medium';

  for (const role of LEADERSHIP_ROLES) {
    try {
      await supabase.functions.invoke('admin-create-notification', {
        body: {
          category: 'safety_alert',
          severity,
          target_type: 'role',
          target_ref: role,
          title: `${emoji} Safety Forecast: ${riskScore.level} Risk`,
          body: `Risk ${riskScore.total.toFixed(1)}/5.0 for ${dateFor}. ${riskScore.drivers[0] || 'Check email for details.'}`,
          url: '/admin/dashboard',
          entity_type: 'forecast',
        },
      });
      console.log('[Push] Sent to role:', role);
    } catch (error) {
      console.error('[Push] Failed for role', role, error);
    }
  }
}
