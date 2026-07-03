import { createFileRoute } from "@tanstack/react-router";

// Endpoint admin : vérifie que la table public.push_dedup existe sur la DB
// réellement utilisée par l'app (getTaxiSupabaseAdmin) et teste l'insertion
// idempotente. Protégé par DRIVER_KEY (header X-Admin-Key ou ?key=).
//
// GET  /api/public/push-dedup-check?key=... → statut + résultat d'un test complet
// POST /api/public/push-dedup-check?key=...&tag=xxx → force un test d'insertion

export const Route = createFileRoute("/api/public/push-dedup-check")({
  server: {
    handlers: {
      GET: async ({ request }) => runCheck(request),
      POST: async ({ request }) => runCheck(request),
    },
  },
});

async function runCheck(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const providedKey =
    request.headers.get("X-Admin-Key") ??
    request.headers.get("x-admin-key") ??
    url.searchParams.get("key") ??
    "";
  const expected = process.env.DRIVER_KEY ?? "";
  if (!expected || providedKey !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { getTaxiSupabaseAdmin, getTaxiSupabaseConfig } = await import("@/lib/taxi-supabase.server");
  const { checkPushDedupHealth } = await import("@/lib/push.server");
  const supabase = getTaxiSupabaseAdmin();
  const config = getTaxiSupabaseConfig();
  const dbHost = (() => {
    try { return new URL(config.supabaseUrl).host; } catch { return config.supabaseUrl; }
  })();

  const report: Record<string, unknown> = {
    db_host: dbHost,
    checked_at: new Date().toISOString(),
  };

  // 1) Health check (existence table)
  const health = await checkPushDedupHealth(true);
  report.table_exists = health.ok;
  if (!health.ok) {
    report.table_error = health.error;
    return new Response(JSON.stringify({ ok: false, ...report }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) Test insert idempotent
  const testTag = url.searchParams.get("tag") ?? `dedup-selftest-${Date.now()}`;
  const audience = "chauffeur";
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  const first = await supabase
    .from("push_dedup" as any)
    .insert({ tag: testTag, audience, expires_at: expiresAt })
    .select("tag")
    .maybeSingle();

  report.first_insert = first.error
    ? { ok: false, code: (first.error as any).code, message: first.error.message }
    : { ok: true, row: first.data };

  // 3) Deuxième insert → doit échouer avec 23505 (unique_violation)
  const second = await supabase
    .from("push_dedup" as any)
    .insert({ tag: testTag, audience, expires_at: expiresAt })
    .select("tag")
    .maybeSingle();

  const secondCode = second.error ? (second.error as any).code : null;
  report.second_insert = {
    dedup_working: secondCode === "23505",
    code: secondCode,
    message: second.error?.message ?? null,
  };

  // 4) Cleanup de la ligne de test
  await supabase.from("push_dedup" as any).delete().eq("tag", testTag).eq("audience", audience);

  const allGood = health.ok && !first.error && secondCode === "23505";
  return new Response(JSON.stringify({ ok: allGood, ...report }, null, 2), {
    status: allGood ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
}
