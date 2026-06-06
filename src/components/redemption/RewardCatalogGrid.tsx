import { memo } from 'react';
import { motion } from 'framer-motion';
import { Gift, Package } from 'lucide-react';
import type { RewardCatalogItem } from '@/types/redemption';
import {
  getStockLabel,
  isCatalogItemInStock,
} from '@/lib/redemptionCopy';

interface RewardCatalogGridProps {
  items: RewardCatalogItem[];
  balance: number;
  onRedeem: (item: RewardCatalogItem) => void;
}

function formatPointsNeeded(balance: number, cost: number): string {
  const needed = cost - balance;
  return `${needed} more point${needed === 1 ? '' : 's'} needed`;
}

export const RewardCatalogGrid = memo(function RewardCatalogGrid({
  items,
  balance,
  onRedeem,
}: RewardCatalogGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <Package className="w-10 h-10 text-white/20 mx-auto mb-3" aria-hidden />
        <p className="text-white/60 text-sm">No rewards available right now. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map((item, index) => {
        const inStock = isCatalogItemInStock(item.stock_qty);
        const canAfford = balance >= item.point_cost;
        const redeemable = inStock && canAfford;

        return (
          <motion.article
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className={`rounded-xl border overflow-hidden flex flex-col ${
              redeemable
                ? 'border-white/10 bg-white/[0.03]'
                : 'border-white/[0.06] bg-white/[0.02] opacity-90'
            }`}
            data-testid={`catalog-item-${item.id}`}
          >
            <div className="relative h-36 bg-gradient-to-br from-[#f6dcb2]/10 via-transparent to-emerald-500/5 flex items-center justify-center">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <Gift className="w-12 h-12 text-[#f6dcb2]/25" aria-hidden />
              )}
              <span
                className={`absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  inStock
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                    : 'bg-red-500/15 text-red-300 border border-red-500/25'
                }`}
              >
                {getStockLabel(item.stock_qty)}
              </span>
            </div>

            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-semibold text-white">{item.name}</h3>
              {item.description && (
                <p className="text-xs text-white/50 mt-1 line-clamp-2">{item.description}</p>
              )}
              <div className="mt-auto pt-3 flex items-end justify-between gap-2">
                <span className="text-lg font-bold text-[#f4c979]">{item.point_cost} pts</span>
                <button
                  type="button"
                  onClick={() => onRedeem(item)}
                  disabled={!redeemable}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-gradient-to-r from-[#f4c979] to-[#d89d3e] text-[#2d1c04] hover:from-[#f6dcb2] hover:to-[#f4c979] disabled:bg-white/10 disabled:text-white/40 disabled:from-transparent disabled:to-transparent"
                  aria-disabled={!redeemable}
                >
                  {!inStock
                    ? 'Out of stock'
                    : !canAfford
                      ? formatPointsNeeded(balance, item.point_cost)
                      : 'Redeem'}
                </button>
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
});
