
-- Fix 1: active_visitors — constrain anonymous writes with WITH CHECK
DROP POLICY IF EXISTS "Anyone can insert active visitor" ON public.active_visitors;
DROP POLICY IF EXISTS "Public can insert active visitor" ON public.active_visitors;
DROP POLICY IF EXISTS "public_insert_active_visitors" ON public.active_visitors;
DROP POLICY IF EXISTS "active_visitors_public_insert" ON public.active_visitors;

CREATE POLICY "active_visitors_public_insert_bounded"
  ON public.active_visitors
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    session_id IS NOT NULL
    AND char_length(session_id) BETWEEN 8 AND 64
    AND (page IS NULL OR char_length(page) <= 200)
    AND last_seen <= (now() + interval '1 minute')
    AND last_seen >= (now() - interval '1 hour')
  );

DROP POLICY IF EXISTS "Anyone can update active visitor" ON public.active_visitors;
DROP POLICY IF EXISTS "Public can update active visitor" ON public.active_visitors;
DROP POLICY IF EXISTS "public_update_active_visitors" ON public.active_visitors;
DROP POLICY IF EXISTS "active_visitors_public_update" ON public.active_visitors;

CREATE POLICY "active_visitors_public_update_bounded"
  ON public.active_visitors
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (
    session_id IS NOT NULL
    AND char_length(session_id) BETWEEN 8 AND 64
    AND (page IS NULL OR char_length(page) <= 200)
    AND last_seen <= (now() + interval '1 minute')
    AND last_seen >= (now() - interval '1 hour')
  );

-- Fix 2: remove `reservations` from Realtime publication.
-- The app uses a Supabase Broadcast channel (`suivi:<id>`) for public tracking,
-- so postgres_changes on `reservations` is unused and only presents a theoretical
-- risk if a future authenticated non-admin JWT ever subscribes to it.
ALTER PUBLICATION supabase_realtime DROP TABLE public.reservations;
