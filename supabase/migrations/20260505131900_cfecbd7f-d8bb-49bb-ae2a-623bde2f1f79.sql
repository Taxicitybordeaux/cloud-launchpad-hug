-- Singleton driver location table
CREATE TABLE public.driver_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  speed double precision,
  heading double precision,
  is_online boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read driver location"
ON public.driver_location FOR SELECT
USING (true);

CREATE POLICY "Admins can insert driver location"
ON public.driver_location FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update driver location"
ON public.driver_location FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete driver location"
ON public.driver_location FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.driver_location REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_location;

-- Seed singleton row
INSERT INTO public.driver_location (latitude, longitude, is_online)
VALUES (44.8378, -0.5792, false);