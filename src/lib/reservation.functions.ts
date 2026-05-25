import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PUBLIC_COLUMNS =
  "id, nom, telephone, email, pickup_datetime, depart, arrivee, passagers, bagages, service_type, message, status, created_at";

export const getReservationPublic = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
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
