CREATE TABLE public.client_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.client_sessions TO service_role;
ALTER TABLE public.client_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX client_sessions_account_idx ON public.client_sessions (client_account_id);
CREATE INDEX client_sessions_expiry_idx ON public.client_sessions (expires_at);