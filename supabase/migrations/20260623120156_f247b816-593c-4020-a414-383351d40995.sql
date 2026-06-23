-- 1. client_accounts: revoke password_hash column access from anon/authenticated
REVOKE SELECT (password_hash) ON public.client_accounts FROM anon, authenticated, PUBLIC;

-- 2. driver_gps: drop anon write policies (backend uses service_role via /api/public/driver-location)
DROP POLICY IF EXISTS "Driver app can insert driver gps" ON public.driver_gps;
DROP POLICY IF EXISTS "Driver app can update driver gps" ON public.driver_gps;

-- 3. reservation_messages: remove from realtime publication (no client-scoped realtime policy exists)
ALTER PUBLICATION supabase_realtime DROP TABLE public.reservation_messages;