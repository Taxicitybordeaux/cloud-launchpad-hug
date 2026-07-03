-- Drop redundant unbounded INSERT policy on active_visitors so the bounded policy is the sole gate
DROP POLICY IF EXISTS "Anyone can upsert their visitor row" ON public.active_visitors;