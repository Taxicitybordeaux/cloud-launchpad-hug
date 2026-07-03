
CREATE TABLE IF NOT EXISTS public.push_dedup (
  tag         text        NOT NULL,
  audience    text        NOT NULL,
  first_sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  PRIMARY KEY (tag, audience)
);

CREATE INDEX IF NOT EXISTS push_dedup_expires_idx ON public.push_dedup (expires_at);

GRANT ALL ON public.push_dedup TO service_role;

ALTER TABLE public.push_dedup ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated → table is service_role-only.
-- Explicit deny policy so PostgREST returns 401/403 rather than empty results.
CREATE POLICY "push_dedup_no_public_access"
  ON public.push_dedup FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);
