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

function readStoredLang(): Lang {
  // Appelé uniquement côté client (dans useState initializer lazy).
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isLang(stored)) return stored;
  } catch {
    /* noop */
  }
  return "fr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Lazy initializer : lit localStorage au premier rendu CLIENT.
  // Côté SSR typeof window === 'undefined' → le lazy fn retourne 'fr'.
  const [lang, setLangState] = useState<Lang>(() => (typeof window === "undefined" ? "fr" : readStoredLang()));

  // Synchronise document.documentElement dès le premier rendu client.
  useEffect(() => {
    applyDocDir(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
