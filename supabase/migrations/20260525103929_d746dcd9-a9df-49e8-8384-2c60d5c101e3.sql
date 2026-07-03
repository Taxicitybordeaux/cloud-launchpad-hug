ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS suivi_id text;
UPDATE public.reservations SET suivi_id = tracking_id WHERE suivi_id IS NULL AND tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reservations_suivi_id_idx ON public.reservations(suivi_id);