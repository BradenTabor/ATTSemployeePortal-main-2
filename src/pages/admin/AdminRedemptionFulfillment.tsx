import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Shield, Sparkles } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAdminRedemptions,
  useFulfillRedemption,
  useDenyRedemption,
} from '@/hooks/redemption';
import { AdminRedemptionQueue } from '@/components/redemption/AdminRedemptionQueue';
import type { RedemptionStatus } from '@/types/redemption';

export default function AdminRedemptionFulfillment() {
  const { isAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState<RedemptionStatus | 'all'>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: allRedemptions = [], isLoading, error } = useAdminRedemptions('all');
  const fulfillMutation = useFulfillRedemption();
  const denyMutation = useDenyRedemption();

  const pending = useMemo(
    () => allRedemptions.filter((r) => r.status === 'pending'),
    [allRedemptions],
  );

  const history = useMemo(() => {
    const nonPending = allRedemptions.filter((r) => r.status !== 'pending');
    if (statusFilter === 'all') return nonPending;
    return nonPending.filter((r) => r.status === statusFilter);
  }, [allRedemptions, statusFilter]);

  const handleFulfill = useCallback(
    async (redemptionId: string, note?: string) => {
      setActionError(null);
      try {
        await fulfillMutation.mutateAsync({ redemptionId, note });
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Fulfillment failed.');
      }
    },
    [fulfillMutation],
  );

  const handleDeny = useCallback(
    async (redemptionId: string, note?: string) => {
      setActionError(null);
      try {
        await denyMutation.mutateAsync({ redemptionId, note });
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Deny failed.');
      }
    },
    [denyMutation],
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
        <div className="text-center" data-testid="admin-access-denied">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" aria-hidden />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Redemption Fulfillment" pageHeading>
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pb-8 pt-4 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30">
              <Sparkles className="w-3.5 h-3.5 text-[#f4c979]" aria-hidden />
              <span className="text-xs font-medium text-[#f4c979]">Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Gift className="w-8 h-8 text-[#f4c979]" aria-hidden />
            <div>
              <h1 className="text-2xl font-bold text-white">Redemption Fulfillment</h1>
              <p className="text-sm text-white/50 mt-0.5">
                Fulfill or deny employee reward requests. Deny refunds points to the requester.
              </p>
            </div>
          </div>
        </motion.div>

        {error ? (
          <p className="text-sm text-red-300" role="alert">
            Unable to load redemption queue. Please try again.
          </p>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : (
          <AdminRedemptionQueue
            pending={pending}
            history={history}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onFulfill={handleFulfill}
            onDeny={handleDeny}
            actionLoading={fulfillMutation.isPending || denyMutation.isPending}
            actionError={actionError}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
