-- Track CTA click events (WhatsApp sticky/float, etc.) to measure conversion.
CREATE TABLE public.cta_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  variant TEXT,
  has_draft BOOLEAN,
  lang TEXT,
  page TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cta_events_type_created_at
  ON public.cta_events (event_type, created_at DESC);

ALTER TABLE public.cta_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous visitors included) can log a click event.
CREATE POLICY "Anyone can log a CTA click"
ON public.cta_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- No public read access: stats are inspected from the backend only.
-- (Omitting a SELECT policy means RLS denies all SELECT for anon/authenticated.)
