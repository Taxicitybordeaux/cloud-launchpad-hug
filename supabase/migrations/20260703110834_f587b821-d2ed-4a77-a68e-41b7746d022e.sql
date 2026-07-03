
-- 1) Drop duplicate trigger
DROP TRIGGER IF EXISTS trg_notify_reservation_http ON public.reservations;
DROP FUNCTION IF EXISTS public.trg_notify_reservation_http();

-- 2) Revoke EXECUTE from anon on internal-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_reservation_completed_to_course() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_notify_new_reservation() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_gps_validated(uuid) FROM anon, PUBLIC;
