/**
 * Admin Safety Agent Page
 * 
 * Provides UI controls to:
 * 1. Generate AI safety announcements (dry-run or save as draft)
 * 2. Test the compliance email webhook via Make.com
 */

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Send,
  CheckCircle,
  AlertTriangle,
  FileText,
  Clock,
  Mail,
  AlertCircle,
  Loader2,
  ClipboardList,
  Truck,
  Wrench,
  Zap,
  DollarSign,
  Bell,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { toast } from '../../lib/toast';
import { GoldCollapsibleSection } from '../../components/admin/GoldCollapsibleSection';
import { createNotificationSilent, NotificationBuilders } from '../../lib/pushNotifications';

// =============================================================================
// TYPES
// =============================================================================

interface GeneratedAnnouncement {
  title: string;
  body: string;
  summary: string;
  sections?: {
    overview?: string;
    topHazards?: Array<{ hazard: string; count: number; note?: string }>;
    ppeReminders?: string[];
    equipmentAlerts?: string[];
    expectations?: string[];
  };
}

interface GenerateStats {
  jsaCount: number;
  dvirCount: number;
  equipmentCount: number;
  totalSubmissions: number;
  topHazards: Array<{ hazard: string; count: number }>;
  nearMissCount: number;
  tokensUsed: number;
}

type NotificationType = 'missing_dvir' | 'missing_equipment' | 'missing_both';

const WINDOW_OPTIONS = [
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 168, label: '7 days' },
];

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'missing_dvir', label: 'Missing DVIR' },
  { value: 'missing_equipment', label: 'Missing Equipment Inspection' },
  { value: 'missing_both', label: 'Missing Both (DVIR + Equipment)' },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AdminSafetyAgent() {
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';

  // Announcement generator state
  const [windowHours, setWindowHours] = useState(24);
  const [generating, setGenerating] = useState(false);
  const [announcement, setAnnouncement] = useState<GeneratedAnnouncement | null>(null);
  const [stats, setStats] = useState<GenerateStats | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [notificationSent, setNotificationSent] = useState<{ dispatched: number; skipped: number } | null>(null);

  // Webhook test state
  const [testEmail, setTestEmail] = useState(user?.email || '');
  const [notificationType, setNotificationType] = useState<NotificationType>('missing_both');
  const [sendingWebhook, setSendingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Calculate estimated cost
  const estimatedCost = useMemo(() => {
    if (!stats?.tokensUsed) return null;
    // gpt-4o-mini pricing: $0.15/1M input, $0.60/1M output
    // Rough estimate assuming 70% input, 30% output
    const inputTokens = stats.tokensUsed * 0.7;
    const outputTokens = stats.tokensUsed * 0.3;
    const cost = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;
    return cost.toFixed(6);
  }, [stats?.tokensUsed]);

  // Generate announcement handler
  const handleGenerate = useCallback(async (dryRun: boolean) => {
    setGenerating(true);
    setGenerateError(null);
    setSavedId(null);
    setNotificationSent(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-safety-announcement', {
        body: {
          windowHours,
          dryRun,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setAnnouncement(data.announcement);
        setStats(data.stats);
        
        if (data.announcementId) {
          setSavedId(data.announcementId);
          
          // Send high-priority push notification to all users
          const notificationPayload = NotificationBuilders.safetyAnnouncement({
            id: data.announcementId,
            title: data.announcement.title,
            body: data.announcement.body,
            summary: data.announcement.summary,
          });
          
          const notificationResult = await createNotificationSilent(notificationPayload);
          
          if (notificationResult) {
            setNotificationSent({
              dispatched: notificationResult.dispatched,
              skipped: notificationResult.skipped,
            });
            toast.success(
              'Safety announcement published!',
              `Saved and pushed to ${notificationResult.dispatched} users`
            );
          } else {
            toast.success('Announcement saved as draft', 'Push notification failed - check console');
          }
        } else if (dryRun) {
          toast.success('Preview generated successfully');
        }
      } else {
        throw new Error(data?.error || 'Failed to generate announcement');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setGenerateError(message);
      toast.error('Generation failed', message);
    } finally {
      setGenerating(false);
    }
  }, [windowHours]);

  // Webhook test handler
  const handleWebhookTest = useCallback(async () => {
    if (!testEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    setSendingWebhook(true);
    setWebhookResult(null);

    try {
      // Get webhook URL from environment or use default
      const webhookUrl = import.meta.env.VITE_MAKE_DEN_WEBHOOK_URL?.trim() || 
        'https://hook.us2.make.com/hdty3eds1lpldxt2ne4amq1dgdohmvpc';

      const missingItems = notificationType === 'missing_both' 
        ? ['DVIR', 'Equipment Inspection']
        : notificationType === 'missing_dvir'
        ? ['DVIR']
        : ['Equipment Inspection'];

      const payload = {
        type: 'compliance_reminder',
        dateFor: new Date().toISOString().slice(0, 10),
        user: {
          id: user?.id || 'test-user-id',
          email: testEmail.trim(),
          fullName: 'Test User',
          role: 'admin',
        },
        missingType: notificationType,
        missingItems,
        appLink: `${window.location.origin}/dashboard`,
        timestamp: new Date().toISOString(),
        notificationId: `test-${Date.now()}`,
        isTest: true,
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setWebhookResult({
          type: 'success',
          message: `Webhook responded with ${response.status} ${response.statusText}`,
        });
        toast.success('Test email sent!', `Check ${testEmail} for the compliance reminder`);
      } else {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setWebhookResult({
        type: 'error',
        message,
      });
      toast.error('Webhook test failed', message);
    } finally {
      setSendingWebhook(false);
    }
  }, [testEmail, notificationType, user?.id]);

  // Access denied for non-admins
  if (!isAdmin) {
    return (
      <DashboardLayout title="Safety Agent">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Safety Agent">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-8 pt-4 sm:pt-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          style={{
            background: 'linear-gradient(145deg, rgba(244, 201, 121, 0.1) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)',
            backdropFilter: 'blur(24px)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(125deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.05)_25%,transparent_50%)]" />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5" />
          
          <div className="relative px-5 py-4 md:px-7 md:py-5">
            <div className="flex items-center gap-3 mb-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30"
              >
                <Bot className="w-3.5 h-3.5 text-[#f4c979]" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f8e5bb]">
                  AI Safety Agent
                </span>
              </motion.div>
            </div>

            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0"
                style={{ boxShadow: '0 0 20px rgba(244, 201, 121, 0.5)' }}
              />
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent">
                  Safety Agent Testing
                </h1>
                <p className="mt-1.5 text-xs sm:text-sm text-[#f8e5bb]/50 font-medium">
                  Generate AI safety announcements and test compliance webhooks
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Announcement Generator Section */}
        <GoldCollapsibleSection
          id="announcement-generator"
          title="Safety Announcement Generator"
          subtitle="Generate AI-powered safety announcements from JSA, DVIR, and equipment data"
          storageKey="admin-announcement-generator-collapsed"
          defaultOpen={true}
          icon={<Sparkles className="w-5 h-5 md:w-6 md:h-6 text-[#f4c979]" />}
        >
          <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="space-y-2 flex-1 max-w-xs">
                <label className="block text-sm font-semibold text-[#f8e5bb]">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Time Window
                </label>
                <select
                  value={windowHours}
                  onChange={(e) => setWindowHours(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-[#1a1814]/80 border border-[#f4c979]/30 text-[#fff6dd] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 transition-all appearance-none cursor-pointer"
                >
                  {WINDOW_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleGenerate(true)}
                  disabled={generating}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-[#f4c979] bg-[#1a1814]/60 border border-[#f4c979]/30 hover:bg-[#1a1814]/80 hover:border-[#f4c979]/50 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {generating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                  Generate Preview
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerate(false)}
                  disabled={generating}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-[#0c0b09] bg-gradient-to-r from-[#f4c979] via-[#f8e5bb] to-[#f4c979] hover:from-[#f8e5bb] hover:via-[#fff6dd] hover:to-[#f8e5bb] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#f4c979]/20"
                >
                  {generating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  Generate & Save Draft
                </button>
              </div>
            </div>

            {/* Error Display */}
            {generateError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Generation Failed</p>
                    <p className="text-sm opacity-80 mt-1">{generateError}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Generated Announcement Preview */}
            {announcement && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-5 rounded-xl bg-[#0f0e0c]/60 border border-[#f4c979]/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#f4c979]">
                      Generated Announcement
                    </h3>
                    <div className="flex items-center gap-2">
                      {savedId && (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Saved
                        </span>
                      )}
                      {notificationSent && (
                        <span className="text-xs px-2 py-1 rounded-full bg-[#f4c979]/20 text-[#f4c979] border border-[#f4c979]/30">
                          📣 Pushed to {notificationSent.dispatched} users
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Title */}
                    <div>
                      <label className="text-xs uppercase tracking-wider text-[#f8e5bb]/60 mb-1 block">
                        Title
                      </label>
                      <p className="text-white font-medium">{announcement.title}</p>
                    </div>

                    {/* Body */}
                    <div>
                      <label className="text-xs uppercase tracking-wider text-[#f8e5bb]/60 mb-1 block">
                        Body <span className="text-[#f4c979]">({announcement.body.length}/283 chars)</span>
                      </label>
                      <p className="text-white/90 text-sm leading-relaxed bg-black/20 rounded-lg p-3">
                        {announcement.body}
                      </p>
                    </div>

                    {/* Summary */}
                    <div>
                      <label className="text-xs uppercase tracking-wider text-[#f8e5bb]/60 mb-1 block">
                        Summary <span className="text-[#f4c979]">({announcement.summary.length}/240 chars)</span>
                      </label>
                      <p className="text-white/80 text-sm bg-black/20 rounded-lg p-3">
                        {announcement.summary}
                      </p>
                    </div>

                    {/* Sections */}
                    {announcement.sections?.topHazards && announcement.sections.topHazards.length > 0 && (
                      <div>
                        <label className="text-xs uppercase tracking-wider text-[#f8e5bb]/60 mb-2 block">
                          Top Hazards
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {announcement.sections.topHazards.map((h, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-sm"
                            >
                              {h.hazard} ({h.count})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                {stats && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="p-3 rounded-xl bg-[#1a1814]/60 border border-[#f4c979]/20 text-center">
                        <ClipboardList className="w-5 h-5 text-[#f4c979] mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{stats.jsaCount}</p>
                        <p className="text-xs text-[#f8e5bb]/60">JSA Forms</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#1a1814]/60 border border-[#f4c979]/20 text-center">
                        <Truck className="w-5 h-5 text-[#f4c979] mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{stats.dvirCount}</p>
                        <p className="text-xs text-[#f8e5bb]/60">DVIR Reports</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#1a1814]/60 border border-[#f4c979]/20 text-center">
                        <Wrench className="w-5 h-5 text-[#f4c979] mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{stats.equipmentCount}</p>
                        <p className="text-xs text-[#f8e5bb]/60">Equipment</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#1a1814]/60 border border-[#f4c979]/20 text-center">
                        <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{stats.nearMissCount}</p>
                        <p className="text-xs text-[#f8e5bb]/60">Near-misses</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#1a1814]/60 border border-[#f4c979]/20 text-center">
                        <Zap className="w-5 h-5 text-[#f4c979] mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">{stats.tokensUsed}</p>
                        <p className="text-xs text-[#f8e5bb]/60">Tokens</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#1a1814]/60 border border-[#f4c979]/20 text-center">
                        <DollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-white">${estimatedCost}</p>
                        <p className="text-xs text-[#f8e5bb]/60">Est. Cost</p>
                      </div>
                    </div>

                    {/* Push Notification Stats */}
                    {notificationSent && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-[#f4c979]/10 border border-[#f4c979]/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-[#f4c979]/20">
                            <Bell className="w-5 h-5 text-[#f4c979]" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#f4c979]">
                              High-Priority Push Notification Sent
                            </p>
                            <p className="text-xs text-[#f8e5bb]/70">
                              Delivered to <span className="font-bold text-white">{notificationSent.dispatched}</span> users
                              {notificationSent.skipped > 0 && (
                                <> · {notificationSent.skipped} skipped (no push subscription)</>
                              )}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </GoldCollapsibleSection>

        {/* Webhook Test Section */}
        <GoldCollapsibleSection
          id="webhook-test"
          title="Compliance Email Webhook Test"
          subtitle="Send a test compliance reminder via the Make.com webhook"
          storageKey="admin-webhook-test-collapsed"
          defaultOpen={true}
          icon={<Mail className="w-5 h-5 md:w-6 md:h-6 text-[#f4c979]" />}
        >
          <div className="space-y-5">
            {/* Email Input */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#f8e5bb]">
                Send To
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address..."
                className="w-full px-4 py-3 rounded-xl bg-[#1a1814]/80 border border-[#f4c979]/30 text-[#fff6dd] placeholder-[#f8e5bb]/40 focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 transition-all"
              />
            </div>

            {/* Notification Type */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#f8e5bb]">
                Missing Submission Type
              </label>
              <select
                value={notificationType}
                onChange={(e) => setNotificationType(e.target.value as NotificationType)}
                className="w-full px-4 py-3 rounded-xl bg-[#1a1814]/80 border border-[#f4c979]/30 text-[#fff6dd] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 transition-all appearance-none cursor-pointer"
              >
                {NOTIFICATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Result Display */}
            {webhookResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border ${
                  webhookResult.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {webhookResult.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">
                      {webhookResult.type === 'success' ? 'Email Sent Successfully' : 'Webhook Test Failed'}
                    </p>
                    <p className="text-sm opacity-80 mt-1">{webhookResult.message}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Send Button */}
            <button
              type="button"
              onClick={handleWebhookTest}
              disabled={sendingWebhook || !testEmail.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-[#0c0b09] bg-gradient-to-r from-[#f4c979] via-[#f8e5bb] to-[#f4c979] hover:from-[#f8e5bb] hover:via-[#fff6dd] hover:to-[#f8e5bb] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#f4c979]/20"
            >
              {sendingWebhook ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Send Test Email to Webhook</span>
                </>
              )}
            </button>

            <p className="text-xs text-[#f8e5bb]/40 text-center">
              This sends a test payload to the Make.com webhook which will trigger an email.
            </p>
          </div>
        </GoldCollapsibleSection>
      </div>
    </DashboardLayout>
  );
}
