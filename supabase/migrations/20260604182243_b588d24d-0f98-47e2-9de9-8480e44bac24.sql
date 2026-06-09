CREATE OR REPLACE FUNCTION public.get_reservation_for_suivi(p_key text)
RETURNS SETOF public.reservations
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.reservations
  WHERE suivi_id = p_key
     OR tracking_id = p_key
     OR (p_key ~ '^[0-9a-fA-F-]{36}$' AND id::text = lower(p_key))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_reservation_for_suivi(text) TO anon, authenticated;