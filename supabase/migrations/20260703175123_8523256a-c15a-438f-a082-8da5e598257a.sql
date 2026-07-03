-- Fix: active_visitors_session_leak
-- Remove public row read access; expose only an aggregate count via SECURITY DEFINER RPC.

DROP POLICY IF EXISTS "Anyone can read visitor count" ON public.active_visitors;

CREATE OR REPLACE FUNCTION public.get_active_visitor_count(p_scope text DEFAULT 'site')
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.active_visitors
  WHERE last_seen >= (now() - interval '90 seconds')
    AND (
      p_scope = 'site'
      OR (p_scope = 'suivi' AND page LIKE '/suivi%')
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_active_visitor_count(text) TO anon, authenticated;