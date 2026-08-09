CREATE TABLE public.reservation_price_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  old_price numeric,
  new_price numeric NOT NULL,
  motif text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_rpc_reservation ON public.reservation_price_changes (reservation_id, created_at DESC);

GRANT SELECT, INSERT ON public.reservation_price_changes TO authenticated;
GRANT ALL ON public.reservation_price_changes TO service_role;

ALTER TABLE public.reservation_price_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read price changes" ON public.reservation_price_changes
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert price changes" ON public.reservation_price_changes
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_price_history_for_suivi(p_key text)
RETURNS TABLE(id uuid, old_price numeric, new_price numeric, motif text, created_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.old_price, c.new_price, c.motif, c.created_at
  FROM public.reservation_price_changes c
  JOIN public.reservations r ON r.id = c.reservation_id
  WHERE r.id::text = lower(p_key) OR r.suivi_id = lower(p_key)
  ORDER BY c.created_at DESC
  LIMIT 50
$$;

GRANT EXECUTE ON FUNCTION public.get_price_history_for_suivi(text) TO anon, authenticated;