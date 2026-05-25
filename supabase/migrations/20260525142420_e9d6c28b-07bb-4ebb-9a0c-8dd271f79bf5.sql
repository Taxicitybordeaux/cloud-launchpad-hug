-- ── cta_events ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can log a CTA click" ON public.cta_events;
CREATE POLICY "Public can log CTA click"
  ON public.cta_events FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(event_type) BETWEEN 1 AND 50
    AND (variant IS NULL OR char_length(variant) <= 50)
    AND (page IS NULL OR char_length(page) <= 500)
    AND (referrer IS NULL OR char_length(referrer) <= 1000)
    AND (lang IS NULL OR char_length(lang) <= 10)
    AND (user_agent IS NULL OR char_length(user_agent) <= 1000)
  );

-- ── push_subscriptions ──────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can subscribe to push" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anyone can unsubscribe by endpoint" ON public.push_subscriptions;
DROP POLICY IF EXISTS "write push ins" ON public.push_subscriptions;
CREATE POLICY "Public can subscribe to push"
  ON public.push_subscriptions FOR INSERT TO anon, authenticated
  WITH CHECK (
    audience IN ('admin','chauffeur','client')
    AND char_length(endpoint) BETWEEN 5 AND 2000
    AND (fcm_token IS NULL OR char_length(fcm_token) BETWEEN 50 AND 500)
    AND (user_agent IS NULL OR char_length(user_agent) <= 1000)
  );
-- Les suppressions de souscriptions passent désormais exclusivement par le
-- service role via les server functions (cf. unsubscribePush / nettoyage FCM).

-- ── reservations ────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can create reservation" ON public.reservations;
DROP POLICY IF EXISTS "Public can insert reservations" ON public.reservations;
CREATE POLICY "Public can create reservation"
  ON public.reservations FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(nom) BETWEEN 1 AND 200
    AND char_length(telephone) BETWEEN 5 AND 30
    AND char_length(depart) BETWEEN 1 AND 500
    AND char_length(arrivee) BETWEEN 1 AND 500
    AND passagers BETWEEN 1 AND 12
    AND (bagages IS NULL OR bagages BETWEEN 0 AND 20)
    AND (email IS NULL OR char_length(email) <= 320)
    AND (message IS NULL OR char_length(message) <= 2000)
  );

-- ── site_analytics ──────────────────────────────────────────
DROP POLICY IF EXISTS "write analytics" ON public.site_analytics;
CREATE POLICY "Public can log analytics"
  ON public.site_analytics FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(event) BETWEEN 1 AND 100
    AND (page IS NULL OR char_length(page) <= 500)
    AND (referrer IS NULL OR char_length(referrer) <= 1000)
    AND (session_id IS NULL OR char_length(session_id) <= 100)
  );

-- ── SECURITY DEFINER lockdown ───────────────────────────────
-- Fonctions internes appelées uniquement côté serveur (service role) :
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_reservation_by_tracking(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notify_new_reservation() FROM PUBLIC, anon, authenticated;

-- has_role : utilisée par les policies RLS — accessible aux authentifiés uniquement
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- get_reservation_public / cancel_reservation_public restent volontairement
-- exécutables par anon+authenticated : ce sont les RPC publiques utilisées
-- par la page de suivi /reservation/:id (le filtrage est fait par UUID).