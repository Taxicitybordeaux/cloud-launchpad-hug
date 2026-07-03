
-- 1. Password reset tokens for client_accounts (custom auth, not Supabase Auth)
CREATE TABLE public.client_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_password_resets_token_idx ON public.client_password_resets(token_hash);
CREATE INDEX client_password_resets_account_idx ON public.client_password_resets(client_account_id);

GRANT ALL ON public.client_password_resets TO service_role;
ALTER TABLE public.client_password_resets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.client_password_resets IS
  'One-time password reset tokens for client_accounts custom auth. Token value is hashed (sha256). Accessed only via server functions using service role.';

-- 2. Recurring rides scheduled by the client
CREATE TABLE public.client_recurring_rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  label text NOT NULL,
  depart text NOT NULL,
  destination text NOT NULL,
  -- 0 = Sunday ... 6 = Saturday (Postgres EXTRACT(dow))
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour smallint NOT NULL CHECK (hour BETWEEN 0 AND 23),
  minute smallint NOT NULL DEFAULT 0 CHECK (minute BETWEEN 0 AND 59),
  passagers smallint NOT NULL DEFAULT 1 CHECK (passagers BETWEEN 1 AND 8),
  bagages smallint NOT NULL DEFAULT 0 CHECK (bagages BETWEEN 0 AND 8),
  paiement text NOT NULL DEFAULT 'cb',
  message text NULL,
  active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_recurring_rides_account_idx ON public.client_recurring_rides(client_account_id);
CREATE INDEX client_recurring_rides_next_run_idx ON public.client_recurring_rides(next_run_at) WHERE active;

GRANT ALL ON public.client_recurring_rides TO service_role;
ALTER TABLE public.client_recurring_rides ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_client_recurring_rides_updated
  BEFORE UPDATE ON public.client_recurring_rides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.client_recurring_rides IS
  'Weekly recurring rides booked by client_accounts. Cron hits /api/public/hooks/recurring-rides-tick hourly to create concrete reservations ~24h before next_run_at. Accessed only via server functions using service role.';
