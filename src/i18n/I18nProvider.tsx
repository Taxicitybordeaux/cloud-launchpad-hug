import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DICTS, LANGUAGES, dirOf, isRtl as isRtlLang, type Lang } from "./dict";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
  isRtl: boolean;
};

const Ctx = createContext<I18nCtx | null>(null);

const STORAGE_KEY = "tcb.lang";
const isLang = (v: string): v is Lang => LANGUAGES.some((l) => l.code === v);

function applyDocDir(l: Lang) {
  if (typeof document === "undefined") return;
  const d = dirOf(l);
  document.documentElement.lang = l;
  document.documentElement.dir = d;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // SSR-safe: always start with 'fr', then hydrate from localStorage / navigator on client.
  const [lang, setLangState] = useState<Lang>("fr");
  // Prevent children from rendering with stale 'fr' lang before localStorage is read.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      // Uniquement si l'utilisateur a fait un choix explicite (localStorage)
      // On n'utilise JAMAIS navigator.language pour éviter que Google
      // et les bots anglophones indexent la version anglaise.
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isLang(stored)) {
        setLangState(stored);
        applyDocDir(stored);
      } else {
        // Pas de choix stocké → on reste en français (défaut SSR)
        applyDocDir("fr");
      }
    } catch {
      /* noop */
    } finally {
      setHydrated(true);
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      applyDocDir(l);
    } catch {
      /* noop */
    }
  };

  const dict = DICTS[lang];
  const t = (key: string) => dict[key] ?? DICTS.fr[key] ?? key;
  const dir = dirOf(lang);
  const isRtl = isRtlLang(lang);

  // Don't render children until localStorage has been read — prevents
  // WhatsAppFloat (and any other client component) from mounting with lang='fr'
  // and then never re-translating because their own `mounted` flag is already set.
  if (!hydrated) return null;

  return <Ctx.Provider value={{ lang, setLang, t, dir, isRtl }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}

export function useT() {
  return useI18n().t;
}
