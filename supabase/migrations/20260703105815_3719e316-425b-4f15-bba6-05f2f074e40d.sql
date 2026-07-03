CREATE OR REPLACE FUNCTION public.trg_notify_new_reservation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net', 'vault'
AS $function$
DECLARE
  v_message_id text := gen_random_uuid()::text;
  v_idem text := 'reservation-' || NEW.id::text;
  v_to text := 'taxi.city033@gmail.com';
  v_service_key text;
BEGIN
  -- Skip if already enqueued/sent
  IF EXISTS (
    SELECT 1 FROM public.email_send_log
    WHERE (template_name = 'new-reservation-admin'
           AND recipient_email = v_to
           AND created_at > now() - interval '1 hour'
           AND status IN ('pending','sent'))
  ) THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  -- Fire-and-forget HTTP call to the /send route with the correct template name.
  BEGIN
    PERFORM net.http_post(
      url := 'https://taxicitybordeaux.fr/lovable/email/transactional/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
      ),
      body := jsonb_build_object(
        'templateName', 'new-reservation-admin',
        'recipientEmail', v_to,
        'idempotencyKey', v_idem,
        'templateData', jsonb_build_object(
          'nom', COALESCE(NEW.nom, 'Client'),
          'phone', COALESCE(NEW.telephone, ''),
          'email', COALESCE(NEW.email, ''),
          'depart', COALESCE(NEW.depart, ''),
          'arrivee', COALESCE(NEW.arrivee, ''),
          'pickup_datetime', to_char(NEW.pickup_datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'passagers', COALESCE(NEW.passagers, 1),
          'bagages', COALESCE(NEW.bagages, 0),
          'admin_url', 'https://taxicitybordeaux.fr/admin/dashboard'
        )
      )::jsonb,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_notify_new_reservation http_post failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;