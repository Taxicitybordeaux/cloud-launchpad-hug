GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT INSERT ON public.push_subscriptions TO anon;
GRANT ALL ON public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS "Public can subscribe as client" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Public can subscribe push devices" ON public.push_subscriptions;

CREATE POLICY "Public can subscribe push devices"
ON public.push_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  audience IN ('client', 'chauffeur')
  AND char_length(endpoint) BETWEEN 5 AND 2000
  AND (fcm_token IS NULL OR char_length(fcm_token) BETWEEN 50 AND 500)
  AND (user_agent IS NULL OR char_length(user_agent) <= 1000)
);