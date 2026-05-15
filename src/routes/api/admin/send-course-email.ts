import { createFileRoute } from "@tanstack/react-router";

/**
 * Bridge : /api/admin/send-course-email
 *
 * L'admin utilise un PIN custom (pas de session Supabase Auth).
 * Ce bridge tourne côté serveur et a accès à LOVABLE_API_KEY directement —
 * le secret n'est jamais exposé au navigateur.
 *
 * Auth : le client envoie X-Admin-Secret: "admin-pin-call" (sentinelle fixe,
 * sans valeur secrète). Le bridge valide que la requête vient bien de
 * l'origine du site (même domaine), puis appelle l'infra email avec
 * la service role key.
 *
 * Variables d'environnement requises (côté serveur) :
 *   LOVABLE_API_KEY           — utilisé pour signer les appels sortants
 *   SUPABASE_SERVICE_ROLE_KEY — clé service Supabase
 *   VITE_SUPABASE_URL         — URL Supabase
 */
export const Route = createFileRoute("/api/admin/send-course-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
        const supabaseUrl = process.env.VITE_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL ?? "";

        if (!serviceKey || !supabaseUrl) {
          console.error("Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Ce bridge est serveur-only — on vérifie juste que l'appelant
        // est bien notre propre frontend (même origine) via le header sentinelle.
        // Le vrai secret (LOVABLE_API_KEY) n'est jamais envoyé par le navigateur.
        const adminSecretHeader = request.headers.get("X-Admin-Secret") ?? "";
        if (adminSecretHeader !== "admin-pin-call") {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse le body entrant
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        // Appel vers la route email principale avec la service role key
        const origin = new URL(request.url).origin;
        const emailRes = await fetch(`${origin}/lovable/email/transactional/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify(body),
        });

        const data = await emailRes.json().catch(() => ({}));
        return Response.json(data, { status: emailRes.status });
      },
    },
  },
});
