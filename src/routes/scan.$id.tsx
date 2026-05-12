import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/scan/$id")({
  head: () => ({ meta: [{ title: "QR scanné – Taxi City Bordeaux" }, { name: "robots", content: "noindex" }] }),
  component: ScanPage,
});

type Step = "reading" | "fetching" | "ok" | "error";

function ScanPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("reading");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    let cancelled = false;
    const toastId = "qr-scan-redirect";
    toast.loading("📷 QR code détecté", { id: toastId, description: "Vérification de la course…" });

    const run = async () => {
      setStep("reading");
      await new Promise(r => setTimeout(r, 350));
      if (cancelled) return;
      setStep("fetching");

      if (!id || id.length < 6) {
        toast.error("QR code invalide", { id: toastId });
        setError("L'identifiant de course est manquant ou incorrect.");
        setStep("error");
        return;
      }
      const { data, error: err } = await supabase
        .from("reservations")
        .select("id, status, tracking_id")
        .eq("tracking_id", id)
        .maybeSingle();
      if (cancelled) return;

      if (err || !data) {
        toast.error("Aucune course trouvée", { id: toastId });
        setError("Ce QR code ne correspond à aucune réservation active.");
        setStep("error");
        return;
      }
      const status = (data.status || "").toLowerCase();
      if (["refusee", "refused", "annulee", "cancelled", "canceled"].includes(status)) {
        toast.error("Course annulée", { id: toastId });
        setError("Cette réservation n'est plus active.");
        setStep("error");
        return;
      }

      toast.success("✅ Course trouvée", { id: toastId, description: "Redirection vers le suivi en temps réel…" });
      setStep("ok");
    };
    run();
    return () => { cancelled = true; };
  }, [id]);

  // Auto-redirect with countdown when ready
  useEffect(() => {
    if (step !== "ok") return;
    if (countdown <= 0) {
      navigate({ to: "/tracking/$id", params: { id } });
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 700);
    return () => clearTimeout(t);
  }, [step, countdown, id, navigate]);

  const stepIcon = step === "ok" ? "✅" : step === "error" ? "⚠️" : step === "fetching" ? "🔎" : "📷";
  const stepLabel =
    step === "reading" ? "Lecture du QR code…" :
    step === "fetching" ? "Récupération des infos de la course…" :
    step === "ok" ? "Course trouvée — redirection en cours" :
    "QR code non valide";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 28, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes pulseRing{0%,100%{box-shadow:0 0 0 0 rgba(14,165,233,0)}50%{box-shadow:0 0 0 16px rgba(14,165,233,0.12)}}@keyframes spinSlow{to{transform:rotate(360deg)}}@keyframes dot{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      <div style={{ width: 110, height: 110, borderRadius: "50%", background: step === "error" ? "rgba(245,158,11,0.12)" : "rgba(14,165,233,0.12)", border: `2px solid ${step === "error" ? "rgba(245,158,11,0.4)" : "rgba(14,165,233,0.4)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, animation: step === "ok" || step === "error" ? "none" : "pulseRing 1.6s infinite" }}>
        {stepIcon}
      </div>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 900, color: "#f8fafc", margin: 0 }}>{stepLabel}</h1>
        {step === "ok" && (
          <p style={{ marginTop: 10, fontSize: 14, color: "#94a3b8" }}>Vous serez redirigé dans <strong style={{ color: "#0ea5e9" }}>{countdown}s</strong>…</p>
        )}
        {step === "error" && error && (
          <p style={{ marginTop: 10, fontSize: 14, color: "#94a3b8", lineHeight: 1.55 }}>{error}</p>
        )}
        {(step === "reading" || step === "fetching") && (
          <div style={{ marginTop: 14, display: "inline-flex", gap: 6 }}>
            {[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", animation: `dot 1.2s ${i * 0.2}s infinite` }} />)}
          </div>
        )}
      </div>
      {step === "ok" && (
        <button onClick={() => navigate({ to: "/tracking/$id", params: { id } })} style={{ padding: "12px 22px", background: "linear-gradient(135deg,#0ea5e9,#0369a1)", color: "#fff", border: "none", borderRadius: 12, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px rgba(14,165,233,0.35)" }}>
          🚕 Voir mon suivi maintenant
        </button>
      )}
      {step === "error" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={() => { setError(null); setCountdown(2); setStep("reading"); /* trigger re-run */ navigate({ to: "/scan/$id", params: { id }, replace: true }); }} style={{ padding: "12px 20px", background: "linear-gradient(135deg,#0ea5e9,#0369a1)", color: "#fff", border: "none", borderRadius: 12, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>🔄 Réessayer</button>
          <button onClick={() => { if (window.history.length > 1) window.history.back(); else navigate({ to: "/" }); }} style={{ padding: "12px 20px", background: "rgba(255,255,255,0.06)", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>← Retour</button>
          <a href="tel:0673072322" style={{ padding: "12px 20px", background: "#22c55e", color: "#fff", borderRadius: 12, textDecoration: "none", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>📞 Appeler</a>
        </div>
      )}
    </div>
  );
}
