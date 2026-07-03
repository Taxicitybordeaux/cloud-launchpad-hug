DROP POLICY IF EXISTS "Driver app can validate gps" ON public.reservations;

CREATE OR REPLACE FUNCTION public.mark_gps_validated(p_reservation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.reservations
     SET gps_validated_at = now()
   WHERE id = p_reservation_id
     AND gps_validated_at IS NULL
     AND status IN ('accepted','en_route','arrived');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_gps_validated(uuid) TO anon, authenticated;