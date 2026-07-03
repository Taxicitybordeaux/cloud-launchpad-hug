
-- Public + authenticated tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_visitors TO anon, authenticated;

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;

GRANT INSERT ON public.cta_events TO anon, authenticated;

GRANT SELECT ON public.driver_gps TO anon, authenticated;
GRANT INSERT, UPDATE ON public.driver_gps TO authenticated;

GRANT SELECT ON public.driver_location TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.driver_location TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.email_send_log TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_send_state TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_unsubscribe_tokens TO anon, authenticated;

GRANT SELECT ON public.push_send_failures TO authenticated;

GRANT INSERT ON public.push_subscriptions TO anon, authenticated;
GRANT SELECT, UPDATE ON public.push_subscriptions TO authenticated;

GRANT SELECT, UPDATE, DELETE ON public.reservation_messages TO authenticated;

GRANT INSERT ON public.reservations TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.reservations TO authenticated;

GRANT SELECT, INSERT ON public.reviews TO anon, authenticated;

GRANT INSERT ON public.site_analytics TO anon, authenticated;
GRANT SELECT ON public.site_analytics TO authenticated;

GRANT SELECT, INSERT ON public.suppressed_emails TO anon, authenticated;

GRANT SELECT ON public.user_roles TO authenticated;

-- Service-role-only tables (sensitive)
GRANT ALL ON public.client_accounts TO service_role;
GRANT ALL ON public.client_account_secrets TO service_role;
GRANT ALL ON public.client_favorites TO service_role;
GRANT ALL ON public.client_password_resets TO service_role;
GRANT ALL ON public.client_recurring_rides TO service_role;
GRANT ALL ON public.direct_messages TO service_role;
GRANT ALL ON public.reservation_messages TO service_role;

-- Always ensure service_role has full access on every public table
GRANT ALL ON public.active_visitors TO service_role;
GRANT ALL ON public.app_settings TO service_role;
GRANT ALL ON public.clients TO service_role;
GRANT ALL ON public.courses TO service_role;
GRANT ALL ON public.cta_events TO service_role;
GRANT ALL ON public.driver_gps TO service_role;
GRANT ALL ON public.driver_location TO service_role;
GRANT ALL ON public.email_send_log TO service_role;
GRANT ALL ON public.email_send_state TO service_role;
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
GRANT ALL ON public.push_send_failures TO service_role;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.reservations TO service_role;
GRANT ALL ON public.reviews TO service_role;
GRANT ALL ON public.site_analytics TO service_role;
GRANT ALL ON public.suppressed_emails TO service_role;
GRANT ALL ON public.user_roles TO service_role;

-- Sequence usage (needed for tables with serial/bigserial or nextval defaults)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
