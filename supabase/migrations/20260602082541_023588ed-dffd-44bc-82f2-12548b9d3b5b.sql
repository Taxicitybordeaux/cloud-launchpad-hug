REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.driver_gps FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.driver_gps FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON public.driver_gps TO anon;
GRANT SELECT, INSERT, UPDATE ON public.driver_gps TO authenticated;
GRANT ALL ON public.driver_gps TO service_role;