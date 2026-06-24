import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CompanyInfo = {
  company_name: string | null;
  siret: string | null;
  tva_intracom: string | null;
  billing_address: string | null;
};

export type InvoiceRow = {
  id: string;
  date: string; // ISO
  reference: string;
  depart: string;
  arrivee: string;
  prix_estime: number;
  paiement: string | null;
};

const IdentitySchema = z.object({
  account_id: z.string().uuid(),
});

export const getClientCompanyInfo = createServerFn({ method: "POST" })
  .inputValidator((input) => IdentitySchema.parse(input))
  .handler(async ({ data }): Promise<CompanyInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("client_accounts")
      .select("company_name,siret,tva_intracom,billing_address")
      .eq("id", data.account_id)
      .maybeSingle();
    return {
      company_name: (row as any)?.company_name ?? null,
      siret: (row as any)?.siret ?? null,
      tva_intracom: (row as any)?.tva_intracom ?? null,
      billing_address: (row as any)?.billing_address ?? null,
    };
  });

const UpdateSchema = z.object({
  account_id: z.string().uuid(),
  company_name: z.string().trim().max(200).nullable(),
  siret: z.string().trim().max(50).nullable(),
  tva_intracom: z.string().trim().max(50).nullable(),
  billing_address: z.string().trim().max(500).nullable(),
});

export const updateClientCompanyInfo = createServerFn({ method: "POST" })
  .inputValidator((input) => UpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("client_accounts")
      .update({
        company_name: data.company_name || null,
        siret: data.siret || null,
        tva_intracom: data.tva_intracom || null,
        billing_address: data.billing_address || null,
      })
      .eq("id", data.account_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BillingListSchema = z.object({
  account_id: z.string().uuid(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().toLowerCase().max(255).optional().nullable(),
  from: z.string(), // ISO
  to: z.string(), // ISO
});

function normalizePhone(p?: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/\D+/g, "");
  return digits.length >= 6 ? digits.slice(-9) : null;
}

export const listCompletedForBilling = createServerFn({ method: "POST" })
  .inputValidator((input) => BillingListSchema.parse(input))
  .handler(async ({ data }): Promise<InvoiceRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cols =
      "id, pickup_datetime, depart, arrivee, destination, status, prix_estime, paiement, tracking_id, client_account_id, client_phone, telephone, client_email, email";

    const orParts: string[] = [];
    orParts.push(`client_account_id.eq.${data.account_id}`);
    const phoneTail = normalizePhone(data.phone);
    if (phoneTail) {
      orParts.push(`client_phone.ilike.%${phoneTail}`);
      orParts.push(`telephone.ilike.%${phoneTail}`);
    }
    if (data.email) {
      orParts.push(`client_email.eq.${data.email}`);
      orParts.push(`email.eq.${data.email}`);
    }

    const { data: rows } = await supabaseAdmin
      .from("reservations")
      .select(cols)
      .or(orParts.join(","))
      .eq("status", "completed")
      .gte("pickup_datetime", data.from)
      .lt("pickup_datetime", data.to)
      .order("pickup_datetime", { ascending: true });

    const seen = new Set<string>();
    return ((rows ?? []) as any[])
      .filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .map((r) => ({
        id: r.id,
        date: r.pickup_datetime,
        reference: (r.tracking_id || r.id).slice(0, 12).toUpperCase(),
        depart: r.depart ?? "",
        arrivee: r.arrivee || r.destination || "",
        prix_estime: Number(r.prix_estime ?? 0),
        paiement: r.paiement ?? null,
      }));
  });
