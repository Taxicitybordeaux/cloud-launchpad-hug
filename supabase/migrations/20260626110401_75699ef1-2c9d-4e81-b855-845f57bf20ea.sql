ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS client_account_id uuid REFERENCES public.client_accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_client_account
  ON public.push_subscriptions(client_account_id)
  WHERE audience = 'client' AND client_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_client_target
  ON public.push_subscriptions(audience, reservation_id, client_account_id)
  WHERE audience = 'client';

NOTIFY pgrst, 'reload schema';