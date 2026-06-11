import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PUBLIC_COLUMNS =
  "id, nom, telephone, email, pickup_datetime, depart, arrivee, passagers, bagages, service_type, message, status, created_at";
const FIN_PUBLIC_COLUMNS =
  "id,depart,destination,arrivee,status,prix_estime,distance_km,nom,client_name,email,client_email,telephone,client_phone,paiement,date_course,heure_course,pickup_datetime,suivi_id";
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const getReservationPublic = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("reservations")
      .select(PUBLIC_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelReservationPublic = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("reservations")
      .update({ status: "annulee" })
      .eq("id", data.id)
      .not("status", "in", "(annulee,terminee)")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: !!updated };
  });

export const getReservationForFinPublic = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ key: z.string().trim().min(3).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = data.key.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const base = supabaseAdmin.from("reservations").select(FIN_PUBLIC_COLUMNS).limit(1);
    const { data: rows, error } = UUID_RE.test(key)
      ? await base.or(`id.eq.${key.toLowerCase()},suivi_id.eq.${key.toLowerCase()}`)
      : await base.eq("suivi_id", key);

    if (error) throw new Error(error.message);
    const row = rows?.[0] ?? null;
    if (!row) return null;
    return {
      ...row,
      destination: row.destination ?? row.arrivee ?? "",
      prix_final: null,
      distance_reelle_km: null,
      duree_reelle_min: null,
      chauffeur_id: null,
      prenom: row.client_name ?? row.nom ?? "Client",
      nom: row.nom ?? row.client_name ?? "Client",
      email: row.email ?? row.client_email ?? "",
      telephone: row.telephone ?? row.client_phone ?? "",
      paiement: row.paiement ?? "especes",
    };
  });
