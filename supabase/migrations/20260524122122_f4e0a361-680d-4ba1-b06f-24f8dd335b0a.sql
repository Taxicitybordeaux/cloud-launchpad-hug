
CREATE OR REPLACE FUNCTION public.get_reservation_by_tracking(p_tracking_id text)
RETURNS TABLE(
  id uuid, nom text, telephone text, email text,
  pickup_datetime timestamp with time zone,
  depart text, arrivee text, destination text,
  passagers integer, nb_passagers integer, bagages integer,
  service_type text, message text, status text,
  tracking_id text, distance_km numeric, prix_estime numeric,
  client_name text, client_phone text, client_email text,
  date_course text, heure_course text,
  created_at timestamp with time zone
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, nom, telephone, email, pickup_datetime, depart, arrivee, destination,
         passagers, nb_passagers, bagages, service_type, message, status,
         tracking_id, distance_km, prix_estime,
         client_name, client_phone, client_email,
         date_course, heure_course, created_at
  FROM public.reservations
  WHERE tracking_id = p_tracking_id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_reservation_by_tracking(text) TO anon, authenticated;
