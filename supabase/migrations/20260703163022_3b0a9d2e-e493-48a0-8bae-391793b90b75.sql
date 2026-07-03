DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.fcm_token IS NOT NULL
  AND b.fcm_token IS NOT NULL
  AND a.fcm_token = b.fcm_token
  AND a.audience = b.audience
  AND COALESCE(a.reservation_id::text, '') = COALESCE(b.reservation_id::text, '')
  AND COALESCE(a.client_account_id::text, '') = COALESCE(b.client_account_id::text, '')
  AND a.created_at < b.created_at;

DROP INDEX IF EXISTS public.push_subscriptions_fcm_token_unique;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_fcm_token_target_unique
  ON public.push_subscriptions (
    fcm_token,
    audience,
    COALESCE(reservation_id::text, ''),
    COALESCE(client_account_id::text, '')
  )
  WHERE fcm_token IS NOT NULL;

NOTIFY pgrst, 'reload schema';