import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react';
import { WalletHero } from '@/components/points/WalletHero';
import DashboardLayout from '@/layouts/DashboardLayout';
import { glass } from '@/lib/glass';
import { Z } from '@/lib/zIndex';
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

  const pageEnter = { duration: 0.2 };

  return (
    <DashboardLayout title="Rewards Store" pageHeading>
      <div className="space-y-6 pb-8 max-w-2xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={pageEnter}
        >
          <nav
            className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4"
            aria-label="Rewards navigation"
          >
            <Link
              to="/my-points"
              className="inline-flex items-center gap-1.5 text-xs text-[#f4c979]/80 hover:text-[#f4c979] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 rounded"
            >
              View My Points
              <ChevronRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
            <Link
              to="/safety-rewards"
              className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 rounded"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
              Back to Safety Rewards
            </Link>
          </nav>
          <h1 className="text-2xl font-bold text-white">Rewards Store</h1>
          <p className="text-sm text-white/60 mt-1">
            Spend your earned points on ATTS gear and gift cards.
          </p>
        </motion.header>

        <WalletHero
          balance={balance}
          isLoading={balanceLoading}
          headingId="store-balance-heading"
          testId="rewards-store-balance"
          subtitle="Available to redeem in the catalog below."
          size="md"
        />

        <RedemptionHowItWorks />

        {/* Catalog */}
        <section aria-labelledby="catalog-heading" className="space-y-3">
          <h2 id="catalog-heading" className="text-lg font-semibold text-white">
            Available rewards
          </h2>
          {catalogError ? (
            <div
              className="rounded-xl border border-red-500/25 bg-red-950/40 p-4"
              role="alert"
            >
              <p className="text-sm text-red-200">
                Unable to load catalog. Please try again later.
              </p>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true" aria-label="Loading catalog">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-56 animate-pulse ${glass.subtle}`} />
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
        <section aria-labelledby="history-heading" className="space-y-3">
          <div>
            <h2 id="history-heading" className="text-lg font-semibold text-white">
              Your redemption history
            </h2>
            <p className="text-xs text-white/50 mt-1">
              Check here for the status of your requests.
            </p>
          </div>
          {historyLoading ? (
            <div className={`h-32 animate-pulse ${glass.subtle}`} aria-busy="true" aria-label="Loading history" />
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
          transition={{ duration: 0.2 }}
          style={{ zIndex: Z.toast }}
          className={`fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm p-4 flex items-start gap-3 ${glass.success}`}
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
