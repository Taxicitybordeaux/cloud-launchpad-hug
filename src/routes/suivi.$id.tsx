// ─────────────────────────────────────────────────────────────
//  PATCH suivi.$id.tsx  — 3 nouvelles features post-course
//  Appliquer les blocs ci-dessous aux emplacements indiqués.
// ─────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// 1.  REMPLACER  `function InvoiceBlock(...)  {`
//     par la version ci-dessous (ajoute état email + bouton)
// ══════════════════════════════════════════════════════════════

function InvoiceBlock({ reservation, locale, t }: { reservation: any; locale: string; t: (k: string) => string }) {
  const [emailSending, setEmailSending] = React.useState(false);
  const [emailSent, setEmailSent] = React.useState(false);

  const handlePrint = () => window.print();

  const handleSendEmail = async () => {
    const email = reservation.email || reservation.client_email || window.prompt("Adresse email du client :");
    if (!email) return;
    setEmailSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-receipt", {
        body: { reservation_id: reservation.id, email },
      });
      if (error) throw error;
      setEmailSent(true);
      toast.success("📧 Reçu envoyé à " + email);
    } catch (e: any) {
      toast.error("Erreur envoi email : " + (e.message ?? "inconnue"));
    } finally {
      setEmailSending(false);
    }
  };

  const handleDownloadPDF = () => {
    const invoiceWindow = window.open("", "_blank");
    if (!invoiceWindow) return;
    const dateStr = reservation.pickup_datetime
      ? new Date(reservation.pickup_datetime).toLocaleString("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Europe/Paris",
        })
      : new Date().toLocaleDateString("fr-FR");
    const prix = reservation.prix_estime
      ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(reservation.prix_estime)
      : "—";
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Facture — Taxi City Bordeaux</title>
<style>
  @media print { body { margin: 0; } .no-print { display: none; } }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; max-width: 700px; margin: 40px auto; padding: 0 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d4ed8; padding-bottom: 20px; margin-bottom: 28px; }
  .brand { font-size: 22px; font-weight: 900; color: #1d4ed8; letter-spacing: -0.5px; }
  .brand small { display: block; font-size: 12px; font-weight: 400; color: #64748b; margin-top: 2px; }
  .meta { text-align: right; font-size: 12px; color: #64748b; }
  .meta strong { display: block; font-size: 16px; color: #1a1a1a; font-weight: 700; }
  h2 { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
  .row:last-child { border: none; }
  .row .label { color: #475569; }
  .row .value { font-weight: 600; }
  .total-box { margin-top: 24px; background: #f8fafc; border-radius: 10px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
  .total-box .label { font-size: 14px; color: #475569; }
  .total-box .amount { font-size: 26px; font-weight: 900; color: #1d4ed8; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  .btn { display: inline-block; margin: 20px 8px 0; padding: 10px 24px; background: #1d4ed8; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
</style></head><body>
<div class="header">
  <div class="brand">🚕 Taxi City Bordeaux<small>taxicitybordeaux.fr · 06 73 07 23 22</small></div>
  <div class="meta"><strong>Reçu de course</strong>N° ${reservation.id.slice(-8).toUpperCase()}<br/>${dateStr}</div>
</div>
<h2>Détails du trajet</h2>
<div class="row"><span class="label">Départ 🟢</span><span class="value">${reservation.depart ?? "—"}</span></div>
<div class="row"><span class="label">Arrivée 🔴</span><span class="value">${reservation.destination ?? reservation.arrivee ?? "—"}</span></div>
${reservation.distance_km != null ? `<div class="row"><span class="label">Distance</span><span class="value">${Number(reservation.distance_km).toFixed(1)} km</span></div>` : ""}
${reservation.nb_passagers != null ? `<div class="row"><span class="label">Passagers</span><span class="value">${reservation.nb_passagers}</span></div>` : ""}
${reservation.mode_paiement ? `<div class="row"><span class="label">Paiement</span><span class="value">${reservation.mode_paiement}</span></div>` : ""}
<div class="total-box"><span class="label">Total course</span><span class="amount">${prix}</span></div>
<div class="no-print" style="text-align:center">
  <button class="btn" onclick="window.print()">🖨️ Imprimer</button>
  <button class="btn" onclick="window.close()" style="background:#64748b">Fermer</button>
</div>
<div class="footer">Taxi City Bordeaux — SIRET : à compléter — TVA non applicable, art. 293 B du CGI<br/>Merci de votre confiance !</div>
</body></html>`;
    invoiceWindow.document.write(html);
    invoiceWindow.document.close();
    setTimeout(() => invoiceWindow.print(), 400);
  };

  return (
    <div className="suivi-premium suivi-card" style={{ marginBottom: "16px", padding: "20px" }}>
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#1d4ed8",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <FileText size={14} /> {t("suivi.receipt_title")}
      </div>

      {/* Récap trajet */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            paddingBottom: "8px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <span style={{ color: "#64748b" }}>{t("suivi.depart_label")} 🟢</span>
          <span style={{ fontWeight: 600, color: "#0f172a", maxWidth: "60%", textAlign: "right" }}>
            {reservation.depart}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            paddingBottom: "8px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <span style={{ color: "#64748b" }}>{t("suivi.arrivee_label")} 🔴</span>
          <span style={{ fontWeight: 600, color: "#0f172a", maxWidth: "60%", textAlign: "right" }}>
            {reservation.destination ?? reservation.arrivee ?? "—"}
          </span>
        </div>
        {reservation.distance_km != null && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "13px",
              paddingBottom: "8px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <span style={{ color: "#64748b" }}>{t("suivi.distance")}</span>
            <span style={{ fontWeight: 600, color: "#0f172a" }}>{Number(reservation.distance_km).toFixed(1)} km</span>
          </div>
        )}
        {reservation.mode_paiement && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "13px",
              paddingBottom: "8px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <span style={{ color: "#64748b" }}>{t("suivi.paiement")}</span>
            <span style={{ fontWeight: 600, color: "#0f172a" }}>{reservation.mode_paiement}</span>
          </div>
        )}
        {reservation.prix_estime != null && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
            <span style={{ fontSize: "13px", color: "#64748b" }}>{t("fin.price_label")}</span>
            <span style={{ fontSize: "22px", fontWeight: 900, color: "#1d4ed8" }}>
              {new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(reservation.prix_estime)}
            </span>
          </div>
        )}
      </div>

      {/* Boutons */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={handlePrint}
          style={{
            flex: 1,
            minWidth: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "11px 10px",
            background: "rgba(255,255,255,0.08)",
            color: "#94a3b8",
            border: "1px solid rgba(148,163,184,0.2)",
            borderRadius: "10px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <PrinterIcon size={14} /> {t("suivi.print")}
        </button>
        <button
          onClick={handleDownloadPDF}
          style={{
            flex: 1,
            minWidth: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "11px 10px",
            background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(29,78,216,0.3)",
          }}
        >
          <Download size={14} /> {t("suivi.download_pdf")}
        </button>
        {/* ── NOUVEAU : Envoyer par email ── */}
        <button
          onClick={handleSendEmail}
          disabled={emailSending || emailSent}
          style={{
            flex: 1,
            minWidth: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "11px 10px",
            background: emailSent
              ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
              : emailSending
                ? "#cbd5e1"
                : "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: emailSending || emailSent ? "not-allowed" : "pointer",
            boxShadow: emailSent ? "0 4px 12px rgba(22,163,74,0.3)" : "0 4px 12px rgba(14,165,233,0.3)",
          }}
        >
          {emailSending ? (
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          ) : emailSent ? (
            <>✓ Envoyé</>
          ) : (
            <>📧 Email</>
          )}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 2.  AJOUTER avant  `function ReviewBlock(...)`
//     le composant RecurringModal
// ══════════════════════════════════════════════════════════════

const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function RecurringModal({ reservation, onClose }: { reservation: any; onClose: () => void }) {
  const [freq, setFreq] = React.useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = React.useState<number>(() => {
    if (reservation.pickup_datetime) {
      return new Date(reservation.pickup_datetime).getDay();
    }
    return 1; // Lundi par défaut
  });
  const [time, setTime] = React.useState<string>(() => {
    if (reservation.pickup_datetime) {
      const d = new Date(reservation.pickup_datetime);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return "08:00";
  });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("recurring_rides").insert([
        {
          source_reservation_id: reservation.id,
          depart: reservation.depart,
          destination: reservation.destination ?? reservation.arrivee,
          nb_passagers: reservation.nb_passagers ?? 1,
          nb_bagages: reservation.nb_bagages ?? 0,
          mode_paiement: reservation.mode_paiement ?? "cb",
          client_name: reservation.client_name,
          frequency: freq,
          day_of_week: dayOfWeek,
          time_hhmm: time,
          active: true,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
      setSaved(true);
      toast.success("🗓️ Trajet récurrent activé !");
      setTimeout(onClose, 1800);
    } catch (e: any) {
      toast.error("Erreur : " + (e.message ?? "inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const freqLabel: Record<string, string> = {
    weekly: "Chaque semaine",
    biweekly: "Toutes les 2 semaines",
    monthly: "Chaque mois",
  };

  return (
    /* Overlay */
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 40px",
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto 20px" }} />

        <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
          🗓️ Réserver ce trajet régulièrement
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          {reservation.depart} → {reservation.destination ?? reservation.arrivee ?? "—"}
        </div>

        {/* Fréquence */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Fréquence
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["weekly", "biweekly", "monthly"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFreq(f)}
                style={{
                  flex: 1,
                  padding: "10px 6px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  border: "2px solid",
                  borderColor: freq === f ? "#1d4ed8" : "#e2e8f0",
                  background: freq === f ? "#eff6ff" : "#fff",
                  color: freq === f ? "#1d4ed8" : "#64748b",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {freqLabel[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Jour */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            {freq === "monthly" ? "Jour de la semaine (premier de ce jour chaque mois)" : "Jour"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DAYS_FR.map((label, i) => (
              <button
                key={i}
                onClick={() => setDayOfWeek(i)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: "2px solid",
                  borderColor: dayOfWeek === i ? "#1d4ed8" : "#e2e8f0",
                  background: dayOfWeek === i ? "#eff6ff" : "#fff",
                  color: dayOfWeek === i ? "#1d4ed8" : "#64748b",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {label.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Heure */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Heure de prise en charge
          </div>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              fontSize: 16,
              color: "#0f172a",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || saved}
          style={{
            width: "100%",
            padding: "15px 16px",
            background: saved
              ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
              : "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 800,
            cursor: saving || saved ? "not-allowed" : "pointer",
            boxShadow: "0 4px 16px rgba(29,78,216,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {saving ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : null}
          {saved ? "✓ Trajet récurrent activé !" : saving ? "Enregistrement…" : "Activer ce trajet récurrent"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 3.  REMPLACER dans SuiviPage le bloc `{isCompleted && (...)}`
//     (les boutons de navigation après InvoiceBlock/ReviewBlock)
//     par la version ci-dessous (ajoute Rebooker + Récurrent)
// ══════════════════════════════════════════════════════════════

// Ajouter ce state dans SuiviPage (après les useState existants) :
//   const [showRecurring, setShowRecurring] = React.useState(false);

// Puis remplacer le bloc isCompleted par :

{
  isCompleted && (
    <>
      <InvoiceBlock reservation={reservation} locale={locale} t={t} />
      <ReviewBlock reservationId={reservation.id} t={t} />

      {/* ── Actions post-course ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
        {/* Rebooker le même trajet */}
        <a
          href={`/reserver?depart=${encodeURIComponent(reservation.depart ?? "")}&destination=${encodeURIComponent(reservation.destination ?? reservation.arrivee ?? "")}&passagers=${reservation.nb_passagers ?? 1}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "13px 16px",
            background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            color: "#fff",
            borderRadius: "10px",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: "14px",
            boxShadow: "0 4px 12px rgba(29, 78, 216, 0.3)",
          }}
        >
          🔁 Réserver le même trajet
        </a>

        {/* Trajet récurrent */}
        <button
          onClick={() => setShowRecurring(true)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "13px 16px",
            background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontWeight: 700,
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
          }}
        >
          <CalendarPlus size={16} /> Réserver ce trajet chaque semaine
        </button>

        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "11px 16px",
            background: "rgba(255,255,255,0.08)",
            color: "#94a3b8",
            borderRadius: "10px",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "13px",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          {t("suivi.back_home")}
        </Link>
      </div>

      {/* Modal récurrent */}
      {showRecurring && <RecurringModal reservation={reservation} onClose={() => setShowRecurring(false)} />}
    </>
  );
}
