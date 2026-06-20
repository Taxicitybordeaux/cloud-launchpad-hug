// Cache-busting version. Bump automatically at build time via VITE_BUILD_ID
// (fallback: timestamp injected at module evaluation). Used to:
//  - Append ?v=APP_VERSION to non-hashed static files (manifest, icons)
//  - Detect a new release on the client and force a full reload + cache wipe
export const APP_VERSION: string =
  (import.meta.env.VITE_BUILD_ID as string | undefined) ?? "2026-06-20-1";
