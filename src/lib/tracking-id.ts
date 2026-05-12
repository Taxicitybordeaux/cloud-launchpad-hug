import { z } from "zod";

/**
 * tracking_id format: standard RFC 4122 UUID v4 (lowercase),
 * exactly the value produced by `crypto.randomUUID()`.
 *
 * Example: "550e8400-e29b-41d4-a716-446655440000"
 */
export const trackingIdSchema = z
  .string({ required_error: "tracking_id est requis" })
  .trim()
  .toLowerCase()
  .uuid({ message: "tracking_id doit être un UUID valide" });

export type TrackingId = z.infer<typeof trackingIdSchema>;

/** Throws a friendly Error if invalid; returns the normalized id on success. */
export function assertTrackingId(value: unknown): TrackingId {
  const result = trackingIdSchema.safeParse(value);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? "tracking_id invalide";
    throw new Error(msg);
  }
  return result.data;
}

/** Generate a new, schema-valid tracking_id. */
export function newTrackingId(): TrackingId {
  return crypto.randomUUID();
}
