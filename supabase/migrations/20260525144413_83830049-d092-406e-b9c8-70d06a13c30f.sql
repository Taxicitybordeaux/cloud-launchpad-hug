ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS route_coords jsonb,
  ADD COLUMN IF NOT EXISTS route_label text;