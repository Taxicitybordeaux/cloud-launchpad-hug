
-- 1) Dédupliquer les lignes existantes qui violeraient la nouvelle contrainte
--    On garde la ligne la plus récente par (fcm_token, audience)
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.fcm_token IS NOT NULL
  AND a.fcm_token = b.fcm_token
  AND a.audience = b.audience
  AND (
    a.last_seen_at < b.last_seen_at
    OR (a.last_seen_at IS NULL AND b.last_seen_at IS NOT NULL)
    OR (a.last_seen_at = b.last_seen_at AND a.id < b.id)
  );

-- 2) Contrainte unique attendue par l'upsert onConflict:"fcm_token,audience"
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_fcm_token_audience_key
  UNIQUE (fcm_token, audience);
