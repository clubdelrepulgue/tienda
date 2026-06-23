-- Add en_route status and timestamp to orders
-- Allows drivers to mark which specific order they're currently heading to

-- Drop the existing status check constraint (name may vary by Postgres version)
DO $$
DECLARE
    c TEXT;
BEGIN
    SELECT constraint_name INTO c
    FROM information_schema.table_constraints
    WHERE table_name = 'orders'
      AND constraint_type = 'CHECK'
      AND constraint_name ILIKE '%status%';
    IF c IS NOT NULL THEN
        EXECUTE 'ALTER TABLE orders DROP CONSTRAINT ' || quote_ident(c);
    END IF;
END$$;

ALTER TABLE orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN ('new', 'accepted', 'preparing', 'ready', 'en_route', 'delivered', 'cancelled'));

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS en_route_at timestamptz;
