-- Belt-and-suspenders : policy INSERT explicite TO public sur reservations
-- (s'ajoute à "Anyone can create reservation" déjà présente)
DROP POLICY IF EXISTS "Public can insert reservations" ON public.reservations;
CREATE POLICY "Public can insert reservations"
ON public.reservations
FOR INSERT
TO public
WITH CHECK (true);