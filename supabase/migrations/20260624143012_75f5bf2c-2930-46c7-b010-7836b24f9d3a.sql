
-- 1. Allow push subscribers to unsubscribe themselves by endpoint (security definer RPC)
CREATE OR REPLACE FUNCTION public.unsubscribe_push(p_endpoint text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_endpoint IS NULL OR char_length(p_endpoint) < 5 OR char_length(p_endpoint) > 2000 THEN
    RETURN false;
  END IF;
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_push(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_push(text) TO anon, authenticated;

COMMENT ON FUNCTION public.unsubscribe_push(text) IS
  'Allows a push subscriber to remove their own subscription by providing their endpoint URL. Proof of endpoint possession authorizes removal.';

-- 2. Document intentional service-role access pattern for reservation_messages
COMMENT ON TABLE public.reservation_messages IS
  'Chat messages between client and driver. Client reads/writes are intentionally routed through trusted server functions using the service role (see src/lib/chat.functions.ts). RLS only grants direct access to admins; no broad anon/authenticated SELECT must ever be added.';

-- 3. Document intentional realtime posture for reservations
COMMENT ON TABLE public.reservations IS
  'Contains customer PII (name, phone, email, addresses). Published to supabase_realtime so admins/drivers receive live updates. SELECT RLS is restricted to admins (has_role admin); non-admin authenticated and anon receive zero rows via PostgREST or Realtime. DO NOT add a broad SELECT policy for anon or authenticated — client-facing reads must go through SECURITY DEFINER RPCs (e.g. get_reservation_for_suivi) or server functions using service role.';
