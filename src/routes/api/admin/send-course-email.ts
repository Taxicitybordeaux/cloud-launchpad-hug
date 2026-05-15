import { createFileRoute } from "@tanstack/react-router";

/**
 * Bridge : /api/admin/send-course-email
 *
 * L'admin utilise un PIN custom (pas de session Supabase Auth).
 * Ce bridge vérifie le secret partagé LOVABLE_API_KEY, puis appelle
 * la route email principale avec la service role key en Bearer.
 *
 * Variables d'environnement requises (côté serveur) :
 *   LOVABLE_API_KEY          — secret partagé avec le client (VITE_LOVABLE_API_KEY)
 *   SUPABASE_SERVICE_ROLE_KEY — clé service Supabase
 *   VITE_SUPABASE_URL        — URL Supabase
 */
export const Route = createFileRoute("/api/admin/send-course-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Vérification du secret admin
        const adminSecret = request.headers.get("X-Admin-Secret") ?? "";
        const expectedSecret = process.env.LOVABLE_API_KEY ?? "";

        if (!expectedSecret) {
          console.error("LOVABLE_API_KEY not set on server");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        if (!adminSecret || adminSecret !== expectedSecret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Parse le body entrant
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
        const supabaseUrl = process.env.VITE_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL ?? "";

        if (!serviceKey || !supabaseUrl) {
          console.error("Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // 3. Appel vers la route email principale avec la service role key
        const origin = new URL(request.url).origin;
        const emailRes = await fetch(`${origin}/lovable/email/transactional/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify(body),
        });

        // 4. Retransmet la réponse telle quelle
        const data = await emailRes.json().catch(() => ({}));
        return Response.json(data, { status: emailRes.status });
      },
    },
  },
});
