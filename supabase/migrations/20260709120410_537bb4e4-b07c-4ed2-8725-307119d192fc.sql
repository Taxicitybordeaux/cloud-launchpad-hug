ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS duree_recomputed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_reservations_duree_recompute_queue
  ON public.reservations (pickup_datetime DESC)
  WHERE duree_recomputed_at IS NULL
    AND status NOT IN ('completed','cancelled','annulee');