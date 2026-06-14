DROP TRIGGER IF EXISTS notify_reservation_http_on_insert ON public.reservations;
CREATE TRIGGER notify_reservation_http_on_insert
AFTER INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_reservation_http();