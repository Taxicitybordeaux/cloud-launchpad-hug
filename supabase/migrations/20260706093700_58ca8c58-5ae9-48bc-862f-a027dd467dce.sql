CREATE TABLE IF NOT EXISTS public.avis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name text NOT NULL,
  note smallint NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire text,
  reservation_id uuid,
  chauffeur_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.avis TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avis TO authenticated;
GRANT ALL ON public.avis TO service_role;

ALTER TABLE public.avis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a review"
  ON public.avis FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "Anyone can read approved reviews"
  ON public.avis FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY "Admins can read all reviews"
  ON public.avis FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reviews"
  ON public.avis FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reviews"
  ON public.avis FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.avis;