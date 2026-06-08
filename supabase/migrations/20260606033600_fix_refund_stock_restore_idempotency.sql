-- Gate follow-up: stock restore must run only when the refund INSERT actually writes a row.
-- Prevents double-deny / duplicate _refund calls from incrementing stock_qty twice.
-- Unlimited catalog items (stock_qty IS NULL) remain a no-op (WHERE stock_qty IS NOT NULL).

CREATE OR REPLACE FUNCTION public._refund_redemption_hold(
  p_redemption public.redemptions,
  p_reason     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refund_id uuid;
BEGIN
  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, reason)
  VALUES
    (p_redemption.user_id, p_redemption.point_cost, 'adjustment',
     p_redemption.id, 'redemptions', false, p_reason)
  ON CONFLICT (reference_id)
    WHERE source = 'adjustment' AND reference_table = 'redemptions'
  DO NOTHING
  RETURNING id INTO v_refund_id;

  IF v_refund_id IS NOT NULL THEN
    UPDATE public.reward_catalog rc
    SET stock_qty = rc.stock_qty + 1,
        updated_at = now()
    WHERE rc.id = p_redemption.item_id
      AND rc.stock_qty IS NOT NULL;
  END IF;
END;
$$;

ALTER FUNCTION public._refund_redemption_hold(public.redemptions, text) OWNER TO postgres;
