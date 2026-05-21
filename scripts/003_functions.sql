CREATE OR REPLACE FUNCTION get_order_by_token(p_token UUID)
RETURNS SETOF orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM orders WHERE public_tracking_token = p_token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_order_items_by_token(p_token UUID)
RETURNS SETOF order_items
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.*
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.public_tracking_token = p_token;
$$;
