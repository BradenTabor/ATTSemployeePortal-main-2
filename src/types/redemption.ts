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
