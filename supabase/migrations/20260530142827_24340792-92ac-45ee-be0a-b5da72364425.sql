REVOKE ALL ON FUNCTION public.trg_notify_reservation_http() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_notify_reservation_http() FROM anon;
REVOKE ALL ON FUNCTION public.trg_notify_reservation_http() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.trg_notify_reservation_http() TO service_role;