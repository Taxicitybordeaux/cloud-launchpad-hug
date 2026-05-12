
-- site_analytics
CREATE TABLE IF NOT EXISTS public.site_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read analytics" ON public.site_analytics FOR SELECT USING (true);
CREATE POLICY "write analytics" ON public.site_analytics FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_site_analytics_event_created ON public.site_analytics(event, created_at);

-- clients
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  total_courses integer NOT NULL DEFAULT 0,
  total_depense numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "write clients ins" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "write clients upd" ON public.clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "write clients del" ON public.clients FOR DELETE USING (true);

-- courses
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  depart text,
  destination text,
  prix_final numeric(8,2),
  paiement text NOT NULL DEFAULT 'especes',
  status text NOT NULL DEFAULT 'en_cours',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "write courses ins" ON public.courses FOR INSERT WITH CHECK (true);
CREATE POLICY "write courses upd" ON public.courses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "write courses del" ON public.courses FOR DELETE USING (true);
CREATE INDEX IF NOT EXISTS idx_courses_created ON public.courses(created_at DESC);

-- reservations: add new spec columns (keep existing ones intact)
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS distance_km numeric(8,2),
  ADD COLUMN IF NOT EXISTS date_course text,
  ADD COLUMN IF NOT EXISTS heure_course text,
  ADD COLUMN IF NOT EXISTS nb_passagers integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tarif_jour boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS prix_estime numeric(8,2),
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'form',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_created ON public.reservations(created_at DESC);

-- public can read reservations (admin UI uses anon — spec wants permissive read)
DROP POLICY IF EXISTS "Public can read reservations" ON public.reservations;
CREATE POLICY "Public can read reservations" ON public.reservations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can update reservations" ON public.reservations;
CREATE POLICY "Public can update reservations" ON public.reservations FOR UPDATE USING (true) WITH CHECK (true);

-- driver_gps: add new columns + ensure 'driver' row
ALTER TABLE public.driver_gps
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS prix_estime text;

INSERT INTO public.driver_gps (id, is_active) VALUES ('driver', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can write driver gps" ON public.driver_gps;
CREATE POLICY "Public can write driver gps ins" ON public.driver_gps FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public can update driver gps" ON public.driver_gps;
CREATE POLICY "Public can update driver gps" ON public.driver_gps FOR UPDATE USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
