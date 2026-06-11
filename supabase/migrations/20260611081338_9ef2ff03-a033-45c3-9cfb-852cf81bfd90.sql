-- 1) Comptes clients
CREATE TABLE IF NOT EXISTS public.client_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  client_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.client_accounts TO service_role;
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access client_accounts"
ON public.client_accounts FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- 2) Lien réservation -> compte client
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS client_account_id UUID REFERENCES public.client_accounts(id);

-- 3) Messages tchat
CREATE TABLE IF NOT EXISTS public.reservation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('client','chauffeur')),
  content TEXT NOT NULL,
  read_by_client BOOLEAN NOT NULL DEFAULT false,
  read_by_chauffeur BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reservation_messages_resa_created_idx
  ON public.reservation_messages(reservation_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.reservation_messages TO anon, authenticated;
GRANT ALL ON public.reservation_messages TO service_role;

ALTER TABLE public.reservation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read reservation messages"
ON public.reservation_messages FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "insert reservation messages"
ON public.reservation_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "update read flags"
ON public.reservation_messages FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

-- 4) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_messages;
