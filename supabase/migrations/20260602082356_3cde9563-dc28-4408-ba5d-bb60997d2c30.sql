GRANT SELECT, UPDATE, INSERT ON public.driver_gps TO anon;

DROP POLICY IF EXISTS "Driver app can update driver gps" ON public.driver_gps;
CREATE POLICY "Driver app can update driver gps"
  ON public.driver_gps
  FOR UPDATE
  TO anon
  USING (id = 'driver')
  WITH CHECK (
    id = 'driver'
    AND (latitude IS NULL OR (latitude BETWEEN 43.5 AND 46.2))
    AND (longitude IS NULL OR (longitude BETWEEN -2.2 AND 1.0))
    AND (accuracy IS NULL OR accuracy <= 5000)
  );

DROP POLICY IF EXISTS "Driver app can insert driver gps" ON public.driver_gps;
CREATE POLICY "Driver app can insert driver gps"
  ON public.driver_gps
  FOR INSERT
  TO anon
  WITH CHECK (
    id = 'driver'
    AND (latitude IS NULL OR (latitude BETWEEN 43.5 AND 46.2))
    AND (longitude IS NULL OR (longitude BETWEEN -2.2 AND 1.0))
    AND (accuracy IS NULL OR accuracy <= 5000)
  );