
-- 1. Move password_hash to a separate secrets table, service_role only
CREATE TABLE IF NOT EXISTS public.client_account_secrets (
  client_account_id UUID NOT NULL PRIMARY KEY REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only service_role can touch this table
GRANT ALL ON public.client_account_secrets TO service_role;
REVOKE ALL ON public.client_account_secrets FROM anon, authenticated, PUBLIC;

ALTER TABLE public.client_account_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages client secrets"
  ON public.client_account_secrets FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Migrate existing hashes
INSERT INTO public.client_account_secrets (client_account_id, password_hash)
SELECT id, password_hash
FROM public.client_accounts
WHERE password_hash IS NOT NULL
ON CONFLICT (client_account_id) DO NOTHING;

-- Drop password_hash from client_accounts
ALTER TABLE public.client_accounts DROP COLUMN IF EXISTS password_hash;

-- 2. Explicit service_role policies for tables flagged as missing client-facing policy
-- (client auth is custom — all access goes through server functions with service_role)

CREATE POLICY "service role manages password resets"
  ON public.client_password_resets FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service role manages recurring rides"
  ON public.client_recurring_rides FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service role manages direct messages"
  ON public.direct_messages FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service role manages reservation messages"
  ON public.reservation_messages FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- client_favorites already has a service_role ALL policy; no change needed.

COMMENT ON TABLE public.client_account_secrets IS 'Password hashes for custom client auth. Service role only; never exposed via PostgREST.';
COMMENT ON TABLE public.client_password_resets IS 'Password reset tokens. Service role only; accessed exclusively via server functions.';
COMMENT ON TABLE public.client_recurring_rides IS 'Recurring rides. Service role only; accessed via server functions (custom client auth).';
COMMENT ON TABLE public.direct_messages IS 'Client/admin DMs. Service role only; accessed via server functions (custom client auth).';
COMMENT ON TABLE public.reservation_messages IS 'Reservation chat. Admins read/write via RLS; clients write via server functions (custom auth).';
