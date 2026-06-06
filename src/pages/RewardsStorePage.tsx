import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Trophy } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useDashboardCardTheme } from '@/contexts/dashboardCardTheme';
import { useTotalPoints } from '@/hooks/useAnnouncementRewards';
import {
  useRewardCatalog,
  useUserRedemptions,
  useRedeemReward,
  useCancelRedemption,
} from '@/hooks/redemption';
import {
  RewardCatalogGrid,
  RedemptionHowItWorks,
  RedemptionHistoryList,
  RedeemConfirmModal,
} from '@/components/redemption';
import type { RewardCatalogItem } from '@/types/redemption';

export default function RewardsStorePage() {
  const { cardClass } = useDashboardCardTheme();
  const { data: balance = 0, isLoading: balanceLoading } = useTotalPoints();
  const { data: catalog = [], isLoading: catalogLoading, error: catalogError } = useRewardCatalog();
  const { data: redemptions = [], isLoading: historyLoading } = useUserRedemptions();

  const redeemMutation = useRedeemReward();
  const cancelMutation = useCancelRedemption();

  const [selectedItem, setSelectedItem] = useState<RewardCatalogItem | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const openRedeemModal = useCallback((item: RewardCatalogItem) => {
    requestIdRef.current = crypto.randomUUID();
    setRedeemError(null);
    setSelectedItem(item);
    setShowSuccess(false);
  }, []);

  const closeRedeemModal = useCallback(() => {
    if (redeemMutation.isPending) return;
    setSelectedItem(null);
    setRedeemError(null);
    requestIdRef.current = null;
  }, [redeemMutation.isPending]);

  const handleConfirmRedeem = useCallback(async () => {
    if (!selectedItem || !requestIdRef.current) return;

    setRedeemError(null);
    try {
      await redeemMutation.mutateAsync({
        itemId: selectedItem.id,
        requestId: requestIdRef.current,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setSelectedItem(null);
        setShowSuccess(false);
        requestIdRef.current = null;
      }, 2000);
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'Redemption failed. Please try again.');
    }
  }, [selectedItem, redeemMutation]);

  const handleCancelRedemption = useCallback(
    async (redemptionId: string) => {
      try {
        await cancelMutation.mutateAsync(redemptionId);
      } catch {
        // Error surfaced via cancelMutation.error
      }
    },
    [cancelMutation],
  );

  const isLoading = balanceLoading || catalogLoading;

  const successMessage = useMemo(() => {
    if (!showSuccess || !selectedItem) return null;
    return `Request submitted for ${selectedItem.name}! Check your history below for status.`;
  }, [showSuccess, selectedItem]);

  return (
    <DashboardLayout title="Rewards Store">
      <div className="space-y-5 pb-8 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Link
            to="/safety-rewards"
            className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            Back to Safety Rewards
          </Link>
          <h1 className="text-2xl font-bold text-white">Rewards Store</h1>
          <p className="text-sm text-white/50 mt-1">
            Spend your earned points on ATTS gear and gift cards.
          </p>
        </motion.div>

        {/* Balance banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`${cardClass} p-4 flex items-center justify-between`}
          data-testid="rewards-store-balance"
        >
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider">Your balance</p>
            {balanceLoading ? (
              <div className="h-8 w-24 bg-white/5 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-bold text-[#f4c979] flex items-center gap-2 mt-0.5">
                <Trophy className="w-6 h-6 text-amber-400" aria-hidden />
                {balance} pts
              </p>
            )}
          </div>
        </motion.div>

        <RedemptionHowItWorks />

        {/* Catalog */}
        <section aria-labelledby="catalog-heading">
          <h2 id="catalog-heading" className="text-lg font-semibold text-white mb-3">
            Available rewards
          </h2>
          {catalogError ? (
            <p className="text-sm text-red-300" role="alert">
              Unable to load catalog. Please try again later.
            </p>
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-56 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : (
            <RewardCatalogGrid
              items={catalog}
              balance={balance}
              onRedeem={openRedeemModal}
            />
          )}
        </section>

        {/* History */}
        <section aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-lg font-semibold text-white mb-3">
            Your redemption history
          </h2>
          <p className="text-xs text-white/40 mb-3">
            Check here for the status of your requests.
          </p>
          {historyLoading ? (
            <div className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />
          ) : (
            <RedemptionHistoryList
              redemptions={redemptions}
              onCancel={handleCancelRedemption}
              cancelLoading={cancelMutation.isPending}
              cancelError={
                cancelMutation.error instanceof Error ? cancelMutation.error.message : null
              }
            />
          )}
        </section>
      </div>

      <RedeemConfirmModal
        isOpen={!!selectedItem && !showSuccess}
        item={selectedItem}
        balance={balance}
        isSubmitting={redeemMutation.isPending}
        error={redeemError}
        onConfirm={handleConfirmRedeem}
        onCancel={closeRedeemModal}
      />

      {showSuccess && successMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[9998] rounded-xl border border-emerald-500/30 bg-emerald-950/90 p-4 flex items-start gap-3 shadow-lg"
          role="status"
          data-testid="redeem-success-toast"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-emerald-100">{successMessage}</p>
        </motion.div>
      )}
    </DashboardLayout>
  );
}
