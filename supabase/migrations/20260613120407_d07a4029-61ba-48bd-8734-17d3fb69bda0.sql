
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('client','chauffeur')),
  content text NOT NULL,
  read_by_client boolean NOT NULL DEFAULT false,
  read_by_chauffeur boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_account_created
  ON public.direct_messages (client_account_id, created_at DESC);

GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: all access is mediated by server functions
-- using the service role client (DirectChatPanel calls *.functions.ts).
