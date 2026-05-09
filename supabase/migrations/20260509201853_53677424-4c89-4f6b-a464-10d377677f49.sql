
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  rating SMALLINT NOT NULL,
  text TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved reviews"
ON public.reviews FOR SELECT
USING (approved = true);

CREATE POLICY "Anyone can submit a review"
ON public.reviews FOR INSERT
WITH CHECK (
  char_length(name) BETWEEN 1 AND 80
  AND char_length(text) BETWEEN 1 AND 1000
  AND rating BETWEEN 1 AND 5
);

CREATE INDEX reviews_created_at_idx ON public.reviews (created_at DESC);
