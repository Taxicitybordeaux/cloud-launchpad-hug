import { createStart } from '@tanstack/react-start';

// NB: aucun serverFn de ce projet n'utilise `requireSupabaseAuth`,
// donc pas besoin d'attacher un token bearer côté client.
// (Retirer attachSupabaseAuth évite un crash SSR sur `createMiddleware`
// quand le module est chargé côté serveur pendant l'hydratation.)
export const startInstance = createStart(() => ({}));
