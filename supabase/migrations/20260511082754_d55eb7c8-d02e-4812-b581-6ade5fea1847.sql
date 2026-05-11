-- Table de position GPS du chauffeur (single-row logique : id = 'driver')
CREATE TABLE IF NOT EXISTS public.driver_gps (
  id text PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT false,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  heading double precision,
  speed double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_gps ENABLE ROW LEVEL SECURITY;

-- Lecture publique (clients qui suivent la course)
CREATE POLICY "Public can read driver gps"
  ON public.driver_gps
  FOR SELECT
  TO public
  USING (true);

-- Écriture réservée aux admins authentifiés
CREATE POLICY "Admins can insert driver gps"
  ON public.driver_gps
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update driver gps"
  ON public.driver_gps
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_gps;
ALTER TABLE public.driver_gps REPLICA IDENTITY FULL;

-- Ligne initiale
INSERT INTO public.driver_gps (id, is_active)
VALUES ('driver', false)
ON CONFLICT (id) DO NOTHING;