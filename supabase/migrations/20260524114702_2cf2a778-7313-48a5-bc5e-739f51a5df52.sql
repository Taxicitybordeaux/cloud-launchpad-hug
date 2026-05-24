
-- clients: admin-only
DROP POLICY IF EXISTS "read clients" ON public.clients;
DROP POLICY IF EXISTS "write clients ins" ON public.clients;
DROP POLICY IF EXISTS "write clients upd" ON public.clients;
DROP POLICY IF EXISTS "write clients del" ON public.clients;

CREATE POLICY "Admins can read clients" ON public.clients
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update clients" ON public.clients
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete clients" ON public.clients
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- courses: admin-only
DROP POLICY IF EXISTS "read courses" ON public.courses;
DROP POLICY IF EXISTS "write courses ins" ON public.courses;
DROP POLICY IF EXISTS "write courses upd" ON public.courses;
DROP POLICY IF EXISTS "write courses del" ON public.courses;

CREATE POLICY "Admins can read courses" ON public.courses
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert courses" ON public.courses
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update courses" ON public.courses
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete courses" ON public.courses
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- driver_gps: remove public write/update; keep public read
DROP POLICY IF EXISTS "Public can write driver gps ins" ON public.driver_gps;
DROP POLICY IF EXISTS "Public can update driver gps" ON public.driver_gps;

-- push_subscriptions: remove public read and public update
DROP POLICY IF EXISTS "read push" ON public.push_subscriptions;
DROP POLICY IF EXISTS "write push upd" ON public.push_subscriptions;
-- keep "write push ins" / "Anyone can subscribe to push" / "Anyone can unsubscribe by endpoint" so clients can still subscribe/unsubscribe

-- reservations: remove public read/update/delete (keep INSERT)
DROP POLICY IF EXISTS "Public can read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public can delete reservations" ON public.reservations;
-- "Anyone can create reservation" and "Public can insert reservations" remain for the public booking form
