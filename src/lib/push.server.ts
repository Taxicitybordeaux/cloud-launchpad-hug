const subSchema = z.object({
  audience: z.enum(["admin", "chauffeur", "client"]),
  fcm_token: z.string().regex(FCM_TOKEN_RE, "fcm_token format invalide"),
  reservation_id: z.string().uuid().optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
});

export const subscribePush = createServerFn({ method: "POST" })
  .inputValidator((input) => subSchema.parse(input))
  .handler(async ({ data }) => {
    const rows = [
      {
        audience: data.audience,
        endpoint: `fcm://${data.fcm_token}`,
        fcm_token: data.fcm_token,
        reservation_id: data.reservation_id ?? null,
        user_agent: data.user_agent ?? null,
        last_seen_at: new Date().toISOString(),
      },
    ];

    if (data.audience === "admin") {
      rows.push({
        audience: "chauffeur",
        endpoint: `fcm://${data.fcm_token}-chauffeur`,
        fcm_token: data.fcm_token,
        reservation_id: null,
        user_agent: data.user_agent ?? null,
        last_seen_at: new Date().toISOString(),
      });
    }

    for (const row of rows) {
      const { error } = await supabaseAdmin
        .from("push_subscriptions")
        .upsert(row, { onConflict: "fcm_token,audience" });
      if (error) {
        console.error("[push] subscribe failed", error);
        throw new Error("subscribe_failed");
      }
    }
    return { ok: true };
  });
