// Lightweight phone normalization to E.164-ish format.
// Not a full libphonenumber, but enough for FR + neighbours.

export type CountryCode = "FR" | "BE" | "CH" | "LU" | "ES" | "IT" | "DE" | "GB" | "PT" | "NL";

export const COUNTRIES: { code: CountryCode; dial: string; flag: string; label: string }[] = [
  { code: "FR", dial: "+33", flag: "🇫🇷", label: "France" },
  { code: "BE", dial: "+32", flag: "🇧🇪", label: "Belgique" },
  { code: "CH", dial: "+41", flag: "🇨🇭", label: "Suisse" },
  { code: "LU", dial: "+352", flag: "🇱🇺", label: "Luxembourg" },
  { code: "ES", dial: "+34", flag: "🇪🇸", label: "Espagne" },
  { code: "IT", dial: "+39", flag: "🇮🇹", label: "Italie" },
  { code: "DE", dial: "+49", flag: "🇩🇪", label: "Allemagne" },
  { code: "GB", dial: "+44", flag: "🇬🇧", label: "Royaume-Uni" },
  { code: "PT", dial: "+351", flag: "🇵🇹", label: "Portugal" },
  { code: "NL", dial: "+31", flag: "🇳🇱", label: "Pays-Bas" },
];

/**
 * Normalize a national/local phone input + country to E.164.
 * Returns null if the result is clearly not a valid phone.
 */
export function normalizePhone(input: string, country: CountryCode): string | null {
  if (!input) return null;
  const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? "+33";

  // Keep digits and a possible leading +
  const cleaned = input.replace(/[^\d+]/g, "");

  let national: string;
  if (cleaned.startsWith("+")) {
    // Already in international form — keep as-is (strip extra +)
    const digits = cleaned.replace(/\+/g, "");
    if (digits.length < 7 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (cleaned.startsWith("00")) {
    const digits = cleaned.slice(2);
    if (digits.length < 7 || digits.length > 15) return null;
    return `+${digits}`;
  }
  // Strip leading zero(s) for trunk prefix
  national = cleaned.replace(/^0+/, "");

  if (national.length < 6 || national.length > 13) return null;
  return `${dial}${national}`;
}

/** Pretty-print a normalized E.164 string (for display only). */
export function formatPhoneDisplay(e164: string): string {
  if (!e164.startsWith("+")) return e164;
  // Group last 9 digits in pairs from the right
  const cc = e164.slice(0, e164.length - 9);
  const rest = e164.slice(e164.length - 9);
  if (rest.length !== 9) return e164;
  return `${cc} ${rest.slice(0, 1)} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
}
