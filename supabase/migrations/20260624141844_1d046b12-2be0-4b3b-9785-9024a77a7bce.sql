CREATE TABLE public.client_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  label text NOT NULL,
  address text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.client_favorites TO service_role;

ALTER TABLE public.client_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages favorites"
  ON public.client_favorites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_client_favorites_client ON public.client_favorites(client_id, sort_order);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_client_favorites_updated_at
  BEFORE UPDATE ON public.client_favorites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();