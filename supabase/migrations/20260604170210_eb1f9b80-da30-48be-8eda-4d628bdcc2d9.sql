ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS gps_validated_at timestamptz;

DROP POLICY IF EXISTS "Driver app can validate gps" ON public.reservations;
CREATE POLICY "Driver app can validate gps"
  ON public.reservations
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);