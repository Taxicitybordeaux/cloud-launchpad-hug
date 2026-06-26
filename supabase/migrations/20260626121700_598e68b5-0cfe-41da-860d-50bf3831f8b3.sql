
-- Create active_visitors table for real-time visitor tracking
CREATE TABLE IF NOT EXISTS public.active_visitors (
  session_id text PRIMARY KEY,
  page text,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_visitors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_visitors TO authenticated;
GRANT ALL ON public.active_visitors TO service_role;

ALTER TABLE public.active_visitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read visitor count" ON public.active_visitors;
CREATE POLICY "Anyone can read visitor count" ON public.active_visitors
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can upsert their visitor row" ON public.active_visitors;
CREATE POLICY "Anyone can upsert their visitor row" ON public.active_visitors
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update visitor rows" ON public.active_visitors;
CREATE POLICY "Anyone can update visitor rows" ON public.active_visitors
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete stale visitor rows" ON public.active_visitors;
CREATE POLICY "Anyone can delete stale visitor rows" ON public.active_visitors
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_active_visitors_last_seen ON public.active_visitors(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_active_visitors_page ON public.active_visitors(page);

-- Enable Realtime for instant chat + visitor sync
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.active_visitors;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
