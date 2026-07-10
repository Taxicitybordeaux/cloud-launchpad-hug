CREATE OR REPLACE FUNCTION public.mark_reservation_read_by_chauffeur(p_reservation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.reservation_messages
     SET read_by_chauffeur = true
   WHERE reservation_id = p_reservation_id
     AND sender = 'client'
     AND read_by_chauffeur = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_reservation_read_by_chauffeur(uuid) TO authenticated, anon, service_role;