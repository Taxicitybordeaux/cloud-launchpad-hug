-- has_role devient SECURITY INVOKER : plus de privilège élevé, donc plus d'alerte du linter
ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Permettre à chaque utilisateur de lire ses propres lignes de user_roles
-- (nécessaire pour que has_role en SECURITY INVOKER puisse vérifier le rôle courant)
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Les RPC publiques get_reservation_public et cancel_reservation_public sont
-- remplacées par des server functions Lovable (supabaseAdmin) appelées
-- directement par la page de suivi. On peut donc les supprimer du schéma public.
DROP FUNCTION IF EXISTS public.get_reservation_public(uuid);
DROP FUNCTION IF EXISTS public.cancel_reservation_public(uuid);