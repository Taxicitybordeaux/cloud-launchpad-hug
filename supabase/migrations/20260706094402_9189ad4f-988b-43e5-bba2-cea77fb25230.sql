-- ── driver_gps: remove public read, restrict to admins ──────────────────────
DROP POLICY IF EXISTS "Public can read driver gps" ON public.driver_gps;
CREATE POLICY "Admins can read driver gps"
  ON public.driver_gps FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.driver_gps FROM anon;

-- ── driver_location: same treatment ─────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read driver location" ON public.driver_location;
CREATE POLICY "Admins can read driver location"
  ON public.driver_location FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.driver_location FROM anon;

-- ── user_roles: belt-and-suspenders — no write path for anon/authenticated ─
-- Role assignment happens only via service_role in server functions.
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;