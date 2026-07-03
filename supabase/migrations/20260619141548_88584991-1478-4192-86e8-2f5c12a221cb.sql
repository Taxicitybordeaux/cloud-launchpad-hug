DROP POLICY IF EXISTS "Admins can receive realtime" ON realtime.messages;
CREATE POLICY "Admins can receive realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
    OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::public.app_role))
  );