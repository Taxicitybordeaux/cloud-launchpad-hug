
-- 1. active_visitors: tighten UPDATE/DELETE
DROP POLICY IF EXISTS "Anyone can update visitor rows" ON public.active_visitors;
DROP POLICY IF EXISTS "Anyone can delete stale visitor rows" ON public.active_visitors;

CREATE POLICY "Update own visitor row (immutable session_id)"
  ON public.active_visitors FOR UPDATE
  TO anon, authenticated
  USING (last_seen > now() - interval '10 minutes')
  WITH CHECK (session_id = session_id);

CREATE POLICY "Delete only stale visitor rows"
  ON public.active_visitors FOR DELETE
  TO anon, authenticated
  USING (last_seen < now() - interval '2 minutes');

-- 2. push_subscriptions: split INSERT policy so 'chauffeur' requires admin
DROP POLICY IF EXISTS "Public can subscribe push devices" ON public.push_subscriptions;

CREATE POLICY "Public can subscribe client push devices"
  ON public.push_subscriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    audience = 'client'
    AND char_length(endpoint) BETWEEN 5 AND 2000
    AND (fcm_token IS NULL OR char_length(fcm_token) BETWEEN 50 AND 500)
    AND (user_agent IS NULL OR char_length(user_agent) <= 1000)
  );

CREATE POLICY "Admins can register chauffeur push devices"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    audience = 'chauffeur'
    AND has_role(auth.uid(), 'admin'::app_role)
    AND char_length(endpoint) BETWEEN 5 AND 2000
    AND (fcm_token IS NULL OR char_length(fcm_token) BETWEEN 50 AND 500)
    AND (user_agent IS NULL OR char_length(user_agent) <= 1000)
  );

-- 3. Remove clients & courses from realtime publication (latent risk)
ALTER PUBLICATION supabase_realtime DROP TABLE public.clients;
ALTER PUBLICATION supabase_realtime DROP TABLE public.courses;

-- 4. reservations: document that client reads go through server functions with service role.
COMMENT ON TABLE public.reservations IS
  'Client-facing reads are proxied through TanStack server functions using the service role key. Direct PostgREST SELECT is admin-only by design.';
