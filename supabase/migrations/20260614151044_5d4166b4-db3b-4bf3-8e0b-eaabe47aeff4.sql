REVOKE EXECUTE ON FUNCTION public.trg_notify_reservation_http() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_notify_reservation_http() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_notify_reservation_http() FROM authenticated;