CREATE OR REPLACE FUNCTION public.trg_notify_reservation_http()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://taxicitybordeaux.fr/api/public/notify-reservation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Notify-Secret', 'taxi-city-reservation-trigger-v1'
    ),
    body := jsonb_build_object('reservation_id', NEW.id)::jsonb,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reservation_http ON public.reservations;

CREATE TRIGGER trg_notify_reservation_http
AFTER INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_reservation_http();