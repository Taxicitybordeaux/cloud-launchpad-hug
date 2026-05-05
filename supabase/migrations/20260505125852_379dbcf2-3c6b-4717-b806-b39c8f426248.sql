-- Public RPC to fetch reservation summary by id (UUID acts as unguessable token)
CREATE OR REPLACE FUNCTION public.get_reservation_public(p_id uuid)
RETURNS TABLE(
  id uuid,
  nom text,
  telephone text,
  email text,
  pickup_datetime timestamptz,
  depart text,
  arrivee text,
  passagers integer,
  bagages integer,
  service_type text,
  message text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nom, telephone, email, pickup_datetime, depart, arrivee,
         passagers, bagages, service_type, message, status, created_at
  FROM public.reservations
  WHERE id = p_id
  LIMIT 1
$$;

-- Public RPC to cancel a reservation by id (only if not already cancelled/done)
CREATE OR REPLACE FUNCTION public.cancel_reservation_public(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.reservations
  SET status = 'annulee'
  WHERE id = p_id
    AND status NOT IN ('annulee', 'terminee');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reservation_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_reservation_public(uuid) TO anon, authenticated;