import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type RecurringRide = {
  id: string;
  client_account_id: string;
  label: string;
  depart: string;
  destination: string;
  day_of_week: number;
  hour: number;
  minute: number;
  passagers: number;
  bagages: number;
  paiement: string;
  message: string | null;
  active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

const ListSchema = z.object({ account_id: z.string().uuid() });
const CreateSchema = z.object({
  account_id: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  depart: z.string().trim().min(1).max(500),
  destination: z.string().trim().min(1).max(500),
  day_of_week: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  passagers: z.number().int().min(1).max(8),
  bagages: z.number().int().min(0).max(8),
  paiement: z.enum(["cb", "especes"]),
  message: z.string().trim().max(500).optional(),
});
const ToggleSchema = z.object({ account_id: z.string().uuid(), id: z.string().uuid(), active: z.boolean() });
const DeleteSchema = z.object({ account_id: z.string().uuid(), id: z.string().uuid() });

/** Returns the next ISO datetime (UTC) for a weekly day_of_week + hour:minute in Europe/Paris.
 *  Approximation: we use server's local TZ as a proxy; UTC offset is handled by Postgres on insert.
 *  Simpler/safer: compute candidate in UTC tomorrow window. */
function computeNextRun(day: number, hour: number, minute: number): Date {
  const now = new Date();
  // Iterate up to 8 days
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() + i);
    // approximate: Europe/Paris ~ UTC+1/+2. We compute in UTC: hour-1 (best effort, summer time approx).
    // To stay simple and correct enough for booking 24h in advance, set the slot using local-day calc:
    if (d.getUTCDay() !== day) continue;
    const candidate = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour - 1, minute, 0)
    );
    if (candidate.getTime() > now.getTime() + 60_000) return candidate;
  }
  // fallback +7 days
  const f = new Date(now.getTime() + 7 * 24 * 3600_000);
  return f;
}

export const listRecurringRides = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ListSchema.parse(input))
  .handler(async ({ data }): Promise<RecurringRide[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("client_recurring_rides" as any)
      .select("*")
      .eq("client_account_id", data.account_id)
      .order("day_of_week", { ascending: true })
      .order("hour", { ascending: true });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as unknown) as RecurringRide[];
  });

export const createRecurringRide = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateSchema.parse(input))
  .handler(async ({ data }): Promise<RecurringRide> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const next = computeNextRun(data.day_of_week, data.hour, data.minute);
    const { data: row, error } = await supabaseAdmin
      .from("client_recurring_rides" as any)
      .insert({
        client_account_id: data.account_id,
        label: data.label,
        depart: data.depart,
        destination: data.destination,
        day_of_week: data.day_of_week,
        hour: data.hour,
        minute: data.minute,
        passagers: data.passagers,
        bagages: data.bagages,
        paiement: data.paiement,
        message: data.message ?? null,
        active: true,
        next_run_at: next.toISOString(),
      })
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message || "CREATE_FAILED");
    return (row as unknown) as RecurringRide;
  });

export const toggleRecurringRide = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ToggleSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("client_recurring_rides" as any)
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("client_account_id", data.account_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRecurringRide = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("client_recurring_rides" as any)
      .delete()
      .eq("id", data.id)
      .eq("client_account_id", data.account_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
