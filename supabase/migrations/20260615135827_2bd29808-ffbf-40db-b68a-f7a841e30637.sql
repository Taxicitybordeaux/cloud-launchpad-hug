
CREATE TABLE IF NOT EXISTS public.push_send_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  audience text NOT NULL,
  tag text,
  reservation_id uuid,
  fcm_token_suffix text,
  http_status int,
  error_code text,
  title text,
  body text,
  user_agent text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_send_failures TO authenticated;
GRANT ALL ON public.push_send_failures TO service_role;

ALTER TABLE public.push_send_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_push_failures"
  ON public.push_send_failures FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_push_send_failures_created_at
  ON public.push_send_failures (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_send_failures_tag
  ON public.push_send_failures (tag);
