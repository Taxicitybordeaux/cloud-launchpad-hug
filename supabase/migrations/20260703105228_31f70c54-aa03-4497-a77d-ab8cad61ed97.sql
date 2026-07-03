
-- Fix #1: Re-attacher le trigger emails admin (fonction déjà présente)
DROP TRIGGER IF EXISTS trg_notify_new_reservation ON public.reservations;
CREATE TRIGGER trg_notify_new_reservation
  AFTER INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_new_reservation();

-- Fix #2a: Purge des subs push orphelines (créées avant fix dédup)
-- Ces lignes n'ont ni user_id ni client_account_id, endpoint legacy inclut fcm_token → doublons ×N sur iOS
DELETE FROM public.push_subscriptions
WHERE endpoint LIKE 'fcm://%';

-- Fix #2b: Dédupe défensive — un fcm_token ne doit exister qu'une fois
-- (garde la ligne la plus récente en cas de doublon futur)
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.fcm_token IS NOT NULL
  AND a.fcm_token = b.fcm_token
  AND a.created_at < b.created_at;

-- Fix #2c: Contrainte unique sur fcm_token pour empêcher toute future accumulation
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_fcm_token_unique
  ON public.push_subscriptions (fcm_token)
  WHERE fcm_token IS NOT NULL;
