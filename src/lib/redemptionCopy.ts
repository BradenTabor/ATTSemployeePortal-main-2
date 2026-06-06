import type { RedemptionStatus } from '@/types/redemption';

/** In-context explainer on the rewards store page. */
export const REDEMPTION_HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Request a reward',
    body: 'Pick an item and confirm. Points are held from your balance right away.',
  },
  {
    step: '2',
    title: 'Admin reviews',
    body: 'Your request stays pending while an admin prepares your item.',
  },
  {
    step: '3',
    title: 'Handed over or refunded',
    body: 'Fulfilled means you received it. Denied or canceled requests refund your points.',
  },
] as const;

/** Plain-language status labels for redemption history. */
export const REDEMPTION_STATUS_LABELS: Record<RedemptionStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  fulfilled: 'Fulfilled',
  denied: 'Denied',
  canceled: 'Canceled',
};

/** Plain-language status meanings shown in history rows. */
export const REDEMPTION_STATUS_MEANINGS: Record<RedemptionStatus, string> = {
  pending: 'Waiting for an admin to fulfill your request.',
  approved: 'Approved and awaiting handoff.',
  fulfilled: 'Handed over — enjoy your reward!',
  denied: 'Denied by admin — your points were refunded.',
  canceled: 'You canceled this request — your points were refunded.',
};

export function getStockLabel(stockQty: number | null): string {
  if (stockQty === null) return 'In stock';
  if (stockQty <= 0) return 'Out of stock';
  if (stockQty <= 3) return `${stockQty} left`;
  return 'In stock';
}

export function isCatalogItemInStock(stockQty: number | null): boolean {
  return stockQty === null || stockQty > 0;
}
