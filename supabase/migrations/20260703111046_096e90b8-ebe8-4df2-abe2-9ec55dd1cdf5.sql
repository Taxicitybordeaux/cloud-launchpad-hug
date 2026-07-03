
-- Drop the broken trigger + function
DROP TRIGGER IF EXISTS trg_notify_new_reservation ON public.reservations;
DROP FUNCTION IF EXISTS public.trg_notify_new_reservation();

-- Recreate the working function (calls the public webhook)
CREATE OR REPLACE FUNCTION public.trg_notify_reservation_http()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net', 'vault'
AS $function$
DECLARE
  v_service_key text;
BEGIN
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'TAXI_SERVICE_KEY'
  LIMIT 1;

  IF v_service_key IS NULL OR length(v_service_key) = 0 THEN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;
  END IF;

  PERFORM net.http_post(
    url := 'https://taxicitybordeaux.fr/api/public/notify-reservation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Notify-Secret', 'taxi-city-reservation-trigger-v1',
      'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
    ),
    body := jsonb_build_object('reservation_id', NEW.id)::jsonb,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trg_notify_reservation_http() FROM anon, PUBLIC;

CREATE TRIGGER trg_notify_reservation_http
AFTER INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_reservation_http();
