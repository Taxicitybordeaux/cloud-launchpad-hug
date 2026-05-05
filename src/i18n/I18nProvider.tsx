import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DICTS, LANGUAGES, type Lang } from "./dict";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

const STORAGE_KEY = "tcb.lang";
const isLang = (v: string): v is Lang => LANGUAGES.some((l) => l.code === v);

export function I18nProvider({ children }: { children: ReactNode }) {
  // SSR-safe: always start with 'fr', then hydrate from localStorage / navigator on client.
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isLang(stored)) {
        setLangState(stored);
        document.documentElement.lang = stored;
        return;
      }
      const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
      if (isLang(nav)) {
        setLangState(nav);
        document.documentElement.lang = nav;
      }
    } catch {
      /* noop */
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    } catch {
      /* noop */
    }
  };

  const dict = DICTS[lang];
  const t = (key: string) => dict[key] ?? DICTS.fr[key] ?? key;

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}

export function useT() {
  return useI18n().t;
}
