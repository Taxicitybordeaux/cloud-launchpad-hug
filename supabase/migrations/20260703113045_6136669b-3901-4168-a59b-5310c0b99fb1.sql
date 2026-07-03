-- 1) active_visitors : retirer la policy UPDATE trop permissive
DROP POLICY IF EXISTS "Anyone can refresh their visitor row" ON public.active_visitors;

-- 2) push_subscriptions : retirer l'INSERT public anonyme
--    (l'inscription passe désormais uniquement par subscribePush server fn en admin)
DROP POLICY IF EXISTS "Public can subscribe client push devices" ON public.push_subscriptions;

-- 3) reservation_messages : retirer de la publication Realtime publique
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'reservation_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.reservation_messages';
  END IF;
END $$;