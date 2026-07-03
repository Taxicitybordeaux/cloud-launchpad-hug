
-- Relax UPDATE policy on active_visitors: la précédente bloquait tout upsert
-- si la ligne existait mais avec last_seen > 10 min → visiteur récurrent invisible.
-- Nouvelle règle : n'importe qui peut mettre à jour n'importe quel session_id
-- (pas d'auth publique). Le DELETE reste protégé (seulement les lignes > 2 min).
DROP POLICY IF EXISTS "Update own visitor row (immutable session_id)" ON public.active_visitors;
CREATE POLICY "Anyone can refresh their visitor row"
  ON public.active_visitors
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
