-- Settings table (single-row)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  tracking_mode text NOT NULL DEFAULT 'single' CHECK (tracking_mode IN ('single','multi')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO public.app_settings (id, tracking_mode)
VALUES (1, 'single')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
CREATE POLICY "Admins can update app_settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert app_settings" ON public.app_settings;
CREATE POLICY "Admins can insert app_settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));