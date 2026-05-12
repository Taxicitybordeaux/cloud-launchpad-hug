ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS tracking_id TEXT;
CREATE INDEX IF NOT EXISTS reservations_tracking_id_idx ON public.reservations(tracking_id);