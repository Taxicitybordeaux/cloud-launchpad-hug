// Helper pour générer les balises hreflang.
// Toutes les pages sont servies à la même URL avec i18n client — on déclare
// donc les 6 langues sur la même URL + x-default (français).
const LANGS = ["fr", "en", "es", "pt", "it", "ar"] as const;

export function hreflangLinks(url: string) {
  return [
    ...LANGS.map((l) => ({ rel: "alternate" as const, hrefLang: l, href: url })),
    { rel: "alternate" as const, hrefLang: "x-default", href: url },
  ];
}
