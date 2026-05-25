-- Trigger automatique: à chaque nouvelle réservation, envoyer immédiatement l'email au taxi/admin
-- en appelant la route publique /api/public/notify-reservation via pg_net.
-- Cela fonctionne même si aucun navigateur admin n'est ouvert.

CREATE OR REPLACE FUNCTION public.trg_notify_new_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_url TEXT := 'https://taxicitybordeaux.fr';
BEGIN
  -- Fire-and-forget HTTP POST vers la route publique
  PERFORM net.http_post(
    url := app_url || '/api/public/notify-reservation',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('reservation_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'insertion à cause d'un échec d'email
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_on_new_reservation ON public.reservations;

CREATE TRIGGER notify_admin_on_new_reservation
AFTER INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_new_reservation();