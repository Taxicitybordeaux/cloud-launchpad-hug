import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { LANGUAGES, type Lang } from "@/i18n/dict";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm font-medium transition hover:border-primary"
      >
        <Globe className="h-4 w-4 text-primary" />
        <span>{current.flag}</span>
        <span className="hidden sm:inline uppercase">{current.code}</span>
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 w-44 overflow-hidden rounded-md border border-border bg-background shadow-lg">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLang(l.code as Lang);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition hover:bg-secondary ${
                l.code === lang ? "text-primary font-semibold" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{l.flag}</span> {l.label}
              </span>
              {l.code === lang && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
