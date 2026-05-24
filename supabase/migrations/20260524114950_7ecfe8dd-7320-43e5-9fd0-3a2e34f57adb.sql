
-- Realtime: restrict channel subscriptions to admins
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can receive realtime" ON realtime.messages;
CREATE POLICY "Admins can receive realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- site_analytics: admin-only read
DROP POLICY IF EXISTS "read analytics" ON public.site_analytics;

CREATE POLICY "Admins can read analytics"
  ON public.site_analytics
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
