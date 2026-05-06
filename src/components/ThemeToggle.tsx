import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "tcb.theme";
type Theme = "light" | "dark";

function apply(t: Theme) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.classList.toggle("light", t === "light");
  r.classList.toggle("dark", t === "dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    try {
      const saved = (localStorage.getItem(KEY) as Theme | null) ?? "dark";
      setTheme(saved);
      apply(saved);
    } catch { apply("dark"); }
  }, []);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    try { localStorage.setItem(KEY, next); } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground/80 transition hover:border-primary hover:text-primary"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
