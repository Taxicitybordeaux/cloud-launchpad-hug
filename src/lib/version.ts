// Cache-busting version. Bump automatically at build time via VITE_BUILD_ID
// or the Vite-injected build timestamp. Used to:
//  - Append ?v=APP_VERSION to non-hashed static files (manifest, icons)
//  - Detect a new release on the client and force a full reload + cache wipe
declare const __APP_BUILD_VERSION__: string | undefined;

const injectedBuildVersion =
  typeof __APP_BUILD_VERSION__ !== "undefined" ? __APP_BUILD_VERSION__ : undefined;

export const APP_VERSION: string =
  (import.meta.env.VITE_BUILD_ID as string | undefined) ?? injectedBuildVersion ?? new Date().toISOString();
