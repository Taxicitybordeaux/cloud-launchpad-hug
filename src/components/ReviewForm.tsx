import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/I18nProvider";
import { toast } from "sonner";

export function ReviewForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !text.trim() || rating < 1) {
      toast.error(t("review.error.fields"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("reviews").insert({
      name: name.trim().slice(0, 80),
      text: text.trim().slice(0, 1000),
      rating,
    });
    setLoading(false);
    if (error) {
      toast.error(t("review.error.submit"));
      return;
    }
    toast.success(t("review.success"));
    setName("");
    setText("");
    setRating(0);
    onSubmitted?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-12 max-w-2xl rounded-2xl border border-border bg-background p-6 md:p-8"
    >
      <h3 className="font-display text-2xl font-semibold">{t("review.title")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("review.intro")}</p>

      <div className="mt-5 flex items-center gap-1" role="radiogroup" aria-label={t("review.rating")}>
        {[1, 2, 3, 4, 5].map((i) => {
          const active = (hover || rating) >= i;
          return (
            <button
              type="button"
              key={i}
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i}`}
              onClick={() => setRating(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              className="p-1 transition hover:scale-110"
            >
              <Star
                className={`h-7 w-7 transition ${
                  active ? "fill-primary text-primary" : "text-muted-foreground/40"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          placeholder={t("review.name.placeholder")}
          className="rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          required
          rows={4}
          placeholder={t("review.text.placeholder")}
          className="rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition hover:opacity-90 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("review.submit")}
      </button>
    </form>
  );
}
