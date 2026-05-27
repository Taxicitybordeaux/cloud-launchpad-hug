
CREATE OR REPLACE FUNCTION public.trg_notify_new_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id text := gen_random_uuid()::text;
  v_idem text := 'reservation-' || NEW.id::text;
  v_subject text;
  v_when text;
  v_html text;
  v_text text;
  v_to text := 'taxi.city033@gmail.com';
BEGIN
  -- Skip if we already enqueued/sent for this reservation
  IF EXISTS (
    SELECT 1 FROM public.email_send_log
    WHERE message_id LIKE 'reservation-' || NEW.id::text || '%'
       OR (template_name = 'new-reservation-admin' AND recipient_email = v_to
           AND created_at > now() - interval '1 hour'
           AND error_message IS NULL
           AND status IN ('pending','sent'))
  ) THEN
    RETURN NEW;
  END IF;

  v_when := to_char(NEW.pickup_datetime AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI');
  v_subject := '🆕 Nouvelle réservation — ' || COALESCE(NEW.nom, 'Client');

  v_html := concat(
    '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#fff;color:#111;">',
    '<div style="max-width:560px;padding:24px;">',
    '<h1 style="font-size:22px;margin:0 0 12px;">🆕 Nouvelle réservation</h1>',
    '<p style="font-size:14px;color:#55575d;margin:0 0 20px;">Une nouvelle course vient d''être réservée sur Taxi City Bordeaux.</p>',
    '<div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px 18px;font-size:14px;line-height:1.6;">',
    '<p><b>Client :</b> ', COALESCE(NEW.nom,'—'), '</p>',
    '<p><b>Téléphone :</b> ', COALESCE(NEW.telephone,'—'), '</p>',
    '<p><b>Email :</b> ', COALESCE(NEW.email,'—'), '</p>',
    '<hr style="border:0;border-top:1px solid #e5e5e5;margin:12px 0;">',
    '<p><b>Date / heure :</b> ', v_when, '</p>',
    '<p><b>Départ :</b> ', COALESCE(NEW.depart,'—'), '</p>',
    '<p><b>Arrivée :</b> ', COALESCE(NEW.arrivee,'—'), '</p>',
    '<hr style="border:0;border-top:1px solid #e5e5e5;margin:12px 0;">',
    '<p><b>Passagers :</b> ', COALESCE(NEW.passagers::text,'1'), '</p>',
    '<p><b>Bagages :</b> ', COALESCE(NEW.bagages::text,'0'), '</p>',
    '</div>',
    '<p style="text-align:center;margin:24px 0;"><a href="https://taxicitybordeaux.fr/admin/dashboard" style="background:#f5c842;color:#0a0a0a;padding:12px 28px;border-radius:8px;font-weight:bold;text-decoration:none;display:inline-block;font-size:14px;">🚕 Voir dans l''admin</a></p>',
    '</div></body></html>'
  );

  v_text := concat(
    'Nouvelle réservation', E'\n',
    'Client: ', COALESCE(NEW.nom,'—'), E'\n',
    'Téléphone: ', COALESCE(NEW.telephone,'—'), E'\n',
    'Email: ', COALESCE(NEW.email,'—'), E'\n',
    'Date/heure: ', v_when, E'\n',
    'Départ: ', COALESCE(NEW.depart,'—'), E'\n',
    'Arrivée: ', COALESCE(NEW.arrivee,'—'), E'\n',
    'Passagers: ', COALESCE(NEW.passagers::text,'1'), E'\n',
    'Bagages: ', COALESCE(NEW.bagages::text,'0'), E'\n',
    'Admin: https://taxicitybordeaux.fr/admin/dashboard'
  );

  -- Log as pending (acts as idempotency marker too)
  INSERT INTO public.email_send_log (message_id, template_name, recipient_email, status)
  VALUES (v_message_id, 'new-reservation-admin', v_to, 'pending');

  -- Enqueue directly into pgmq — processed by the cron job every 5s
  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'message_id', v_message_id,
      'to', v_to,
      'from', 'Taxi City Bordeaux <noreply@notify.taxicitybordeaux.fr>',
      'reply_to', 'taxi.city033@gmail.com',
      'sender_domain', 'notify.taxicitybordeaux.fr',
      'subject', v_subject,
      'html', v_html,
      'text', v_text,
      'purpose', 'transactional',
      'label', 'new-reservation-admin',
      'idempotency_key', v_idem,
      'queued_at', now()
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the insert
  RETURN NEW;
END;
$$;
