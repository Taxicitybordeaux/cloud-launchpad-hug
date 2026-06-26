-- Force PostgREST to reload its schema cache so the existing
-- push_subscriptions_endpoint_key UNIQUE (endpoint) constraint is
-- recognized by future ON CONFLICT calls.
NOTIFY pgrst, 'reload schema';