/** Matches public.redemption_status enum in Postgres. */
export type RedemptionStatus =
  | 'pending'
  | 'approved'
  | 'fulfilled'
  | 'denied'
  | 'canceled';

export interface RewardCatalogItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  point_cost: number;
  stock_qty: number | null;
  category: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Admin catalog row includes redemption count for delete-guard UX. */
export interface AdminCatalogItem extends RewardCatalogItem {
  redemption_count: number;
}

export const CATALOG_CATEGORIES = ['apparel', 'gear', 'gift_card', 'other'] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export const CATALOG_CATEGORY_LABELS: Record<CatalogCategory, string> = {
  apparel: 'Apparel',
  gear: 'Gear',
  gift_card: 'Gift Card',
  other: 'Other',
};

export interface RedemptionRecord {
  id: string;
  user_id: string;
  item_id: string;
  point_cost: number;
  status: RedemptionStatus;
  request_id: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  fulfillment_note: string | null;
}

export interface RedemptionWithItem extends RedemptionRecord {
  item_name: string;
  item_image_url: string | null;
}

export interface AdminRedemptionRow extends RedemptionWithItem {
  requester_name: string | null;
  requester_email: string | null;
}
