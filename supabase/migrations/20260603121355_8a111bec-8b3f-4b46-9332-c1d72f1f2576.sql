ALTER TABLE public.driver_gps
ADD COLUMN IF NOT EXISTS heartbeat_at timestamp with time zone;

UPDATE public.driver_gps
SET heartbeat_at = COALESCE(heartbeat_at, updated_at, now())
WHERE id = 'driver';