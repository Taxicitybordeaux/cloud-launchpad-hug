// src/hooks/useLang.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { LANGUAGES, DICTS, dirOf, type Lang } from "@/i18n/dict";

const STORAGE_KEY = "lang";
const DEFAULT_LANG: Lang = "fr";

function getInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  return DEFAULT_LANG;
}

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);

  const t = (key: string): string => {
    return DICTS[lang]?.[key] ?? DICTS[DEFAULT_LANG]?.[key] ?? key;
  };

  return <LangContext.Provider value={{ lang, setLang, t, dir: dirOf(lang) }}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // Fallback so components don't crash if used outside a provider
    const lang = getInitialLang();
    return {
      lang,
      setLang: () => {},
      t: (key: string) => DICTS[lang]?.[key] ?? DICTS[DEFAULT_LANG]?.[key] ?? key,
      dir: dirOf(lang),
    };
  }
  return ctx;
}
