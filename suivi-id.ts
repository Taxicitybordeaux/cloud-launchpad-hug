import { z } from "zod";

/**
 * suivi_id format: standard RFC 4122 UUID v4 (lowercase),
 * exactly the value produced by `crypto.randomUUID()`.
 *
 * Example: "550e8400-e29b-41d4-a716-446655440000"
 */
export const suiviIdSchema = z
  .string({ required_error: "suivi_id est requis" })
  .trim()
  .toLowerCase()
  .uuid({ message: "suivi_id doit être un UUID valide" });

export type SuiviId = z.infer<typeof suiviIdSchema>;

/** Throws a friendly Error if invalid; returns the normalized id on success. */
export function assertSuiviId(value: unknown): SuiviId {
  const result = suiviIdSchema.safeParse(value);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? "suivi_id invalide";
    throw new Error(msg);
  }
  return result.data;
}

/** Generate a new, schema-valid suivi_id. */
export function newSuiviId(): SuiviId {
  return crypto.randomUUID();
}
