import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix } from "@/lib/tarif";
import { assertTrackingId, newTrackingId } from "@/lib/tracking-id";

export const Route = createFileRoute("/admin/courses")({
  head: () => ({
    meta: [{ title: "Courses — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: CoursesPage,
});

type R = any;

const tabKeys = ["pending", "accepted", "refused"] as const;

// Normalise les statuts venant de la base (par défaut "nouvelle") vers les
// 3 onglets de l'admin. Tout ce qui n'est pas explicitement accepted/refused
// est considéré comme en attente.
const normalizeStatus = (s: unknown): (typeof tabKeys)[number] => {
  if (s === "accepted") return "accepted";
  if (s === "refused") return "refused";
  return "pending";
};

const tabLabels: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptées",
  refused: "Refusées",
};

function CoursesPage() {
  const [tab, setTab] = useState<(typeof tabKeys)[number]>("pending");

  const [items, setItems] = useState<R[]>([]);

  const [counts, setCounts] = useState({
    pending: 0,
    accepted: 0,
    refused: 0,
  });

  const [simKm, setSimKm] = useState(5);
  const [simJour, setSimJour] = useState(true);
  const [simOpen, setSimOpen] = useState(false);

  // Boîte de confirmation accepter / refuser
  const [confirmAction, setConfirmAction] = useState<{
    type: "accept" | "refuse";
    r: R;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const initialLoad = useRef(true);

  // =========================
  // FETCH
  // =========================

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase.from("reservations").select("*").order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error(error);
      return;
    }

    const rows = data ?? [];

    setItems(rows);

    const nextCounts = {
      pending: 0,
      accepted: 0,
      refused: 0,
    };

    rows.forEach((r: R) => {
      nextCounts[normalizeStatus(r.status)]++;
    });

    setCounts(nextCounts);
  }, []);

  // =========================
  // REALTIME
  // =========================

  useEffect(() => {
    fetchAll();

    const ch = supabase
      .channel("courses-realtime")

      // INSERT
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reservations",
        },
        (payload) => {
          if (!initialLoad.current) {
            const n = payload.new as R;

            // son
            try {
              new Audio("/notification.mp3").play().catch(() => {});
            } catch {}

            // popup
            if (typeof window !== "undefined") {
              const toast = document.createElement("div");

              toast.textContent = `🔔 Nouvelle réservation de ${n.client_name || n.nom || "Client"}`;

              toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #0ea5e9;
                color: white;
                padding: 14px 20px;
                border-radius: 12px;
                font-family: DM Sans, sans-serif;
                font-weight: 700;
                z-index: 9999;
                box-shadow: 0 8px 24px rgba(0,0,0,0.3);
              `;

              document.body.appendChild(toast);

              setTimeout(() => {
                toast.remove();
              }, 5000);
            }
          }

          fetchAll();
        },
      )

      // UPDATE
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservations",
        },
        () => {
          fetchAll();
        },
      )

      .subscribe();

    initialLoad.current = false;

    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchAll]);

  // =========================
  // ACCEPT
  // =========================

  const handleAccept = async (r: R) => {
    // Validate tracking_id format BEFORE any DB write.
    // - Reuse a valid existing id, otherwise generate a fresh UUID.
    // - Refuse the update if the value cannot be normalized to a UUID.
    let trackingId: string;
    try {
      trackingId = r.tracking_id ? assertTrackingId(r.tracking_id) : newTrackingId();
      // Defensive: re-validate the generated id too.
      assertTrackingId(trackingId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "tracking_id invalide";
      console.error("[admin.courses] tracking_id validation failed:", msg);
      if (typeof window !== "undefined") alert(`❌ ${msg}`);
      return;
    }

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "accepted",
        tracking_id: trackingId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);

    if (error) {
      console.error(error);
      return;
    }

    const phone = r.client_phone || r.telephone;

    const name = r.client_name || r.nom;

    const email = r.client_email || r.email;

    // ajout client
    if (phone) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id,total_courses")
        .eq("phone", phone)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("clients")
          .update({
            total_courses: (existing.total_courses ?? 0) + 1,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("clients").insert({
          name,
          phone,
          email,
          total_courses: 1,
        });
      }
    }

    // son
    try {
      new Audio("/notification.mp3").play().catch(() => {});
    } catch {}

    // popup tracking
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/tracking/${trackingId}` : "";

    if (typeof window !== "undefined" && url) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
    }

    // 📧 Notifie le client par email pour l'inviter à scanner / ouvrir le suivi
    let emailStatus = "non envoyé (pas d'email client)";
    if (email && url) {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const accessToken = sess?.session?.access_token;
        if (!accessToken) {
          emailStatus = "non envoyé (session admin expirée)";
        } else {
          const res = await fetch("/lovable/email/transactional/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              templateName: "course-accepted",
              recipientEmail: email,
              idempotencyKey: `course-accepted-${r.id}`,
              templateData: {
                nom: name,
                depart: r.depart,
                arrivee: r.arrivee || r.destination,
                pickup_datetime: r.pickup_datetime
                  ? new Date(r.pickup_datetime).toLocaleString("fr-FR")
                  : undefined,
                tracking_url: url,
              },
            }),
          });
          emailStatus = res.ok ? "✉️ envoyé au client" : `échec (${res.status})`;
        }
      } catch (e) {
        console.error("[admin.courses] email send failed:", e);
        emailStatus = "échec (réseau)";
      }
    }

    if (typeof window !== "undefined") {
      alert(
        `Course acceptée ✅\n\nLien tracking copié :\n${url}\n\nNotification client : ${emailStatus}`,
      );
    }

    fetchAll();
  };

  // =========================
  // REFUSE
  // =========================

  const handleRefuse = async (r: R) => {
    const { error } = await supabase
      .from("reservations")
      .update({
        status: "refused",
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);

    if (error) {
      console.error(error);
      return;
    }

    fetchAll();
  };

  // =========================
  // DATA
  // =========================

  const filtered = items.filter((r) => normalizeStatus(r.status) === tab);

  const simPrix = calculerPrix(simKm, simJour);

  // =========================
  // UI
  // =========================

  return (
    <div
      style={{
        padding: "32px 24px",
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <h1
        style={{
          fontFamily: "'Syne',sans-serif",
          fontSize: 30,
          fontWeight: 800,
          color: "#f8fafc",
          marginBottom: 24,
        }}
      >
        Courses
      </h1>

      {/* SIMULATEUR */}

      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          padding: 18,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => setSimOpen((o) => !o)}
          style={{
            background: "transparent",
            border: 0,
            color: "#0ea5e9",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {simOpen ? "▼" : "▶"} Simulateur de tarif
        </button>

        {simOpen && (
          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              type="number"
              value={simKm}
              onChange={(e) => setSimKm(Number(e.target.value))}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
              }}
            />

            <label
              style={{
                color: "#cbd5e1",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input type="checkbox" checked={simJour} onChange={(e) => setSimJour(e.target.checked)} />
              Tarif jour
            </label>

            <span
              style={{
                color: "#94a3b8",
              }}
            >
              ≈{" "}
              <b
                style={{
                  color: "#0ea5e9",
                }}
              >
                {simPrix} €
              </b>
            </span>
          </div>
        )}
      </div>

      {/* TABS */}

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {tabKeys.map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 700,
              border: tab === k ? "1px solid rgba(14,165,233,0.4)" : "1px solid rgba(255,255,255,0.08)",
              background: tab === k ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)",
              color: tab === k ? "#0ea5e9" : "#94a3b8",
            }}
          >
            {tabLabels[k]} ({counts[k]})
          </button>
        ))}
      </div>

      {/* LISTE */}

      {filtered.map((r) => {
        const phone = r.client_phone || r.telephone;

        const email = r.client_email || r.email;

        const name = r.client_name || r.nom;

        const dest = r.destination || r.arrivee;

        const prix =
          r.prix_estime ?? (r.distance_km ? calculerPrix(Number(r.distance_km), r.tarif_jour ?? true) : null);

        return (
          <div
            key={r.id}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: 20,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {name}
                </div>

                <div
                  style={{
                    color: "#cbd5e1",
                    marginTop: 8,
                  }}
                >
                  🟢 {r.depart} → 📍 {dest}
                </div>
              </div>

              <div
                style={{
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                {new Date(r.created_at).toLocaleString("fr-FR")}
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              {r.distance_km && <span>🚕 {r.distance_km} km</span>}

              {prix && <span>💰 ≈ {Number(prix).toFixed(2)} €</span>}

              <span>👥 {r.nb_passagers || r.passagers || 1}</span>

              <span>{r.tarif_jour === false ? "🌙 Nuit" : "☀️ Jour"}</span>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              {phone && (
                <a
                  href={`tel:${phone}`}
                  style={{
                    color: "#0ea5e9",
                    textDecoration: "none",
                  }}
                >
                  📞 {phone}
                </a>
              )}

              {email && (
                <a
                  href={`mailto:${email}`}
                  style={{
                    color: "#94a3b8",
                    textDecoration: "none",
                  }}
                >
                  ✉️ {email}
                </a>
              )}
            </div>

            {/* BOUTONS */}

            {normalizeStatus(r.status) === "pending" && (
              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  gap: 10,
                }}
              >
                <button
                  onClick={() => setConfirmAction({ type: "accept", r })}
                  style={{
                    background: "#22c55e",
                    color: "#fff",
                    border: 0,
                    padding: "12px 18px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  ✓ Accepter
                </button>

                <button
                  onClick={() => setConfirmAction({ type: "refuse", r })}
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    border: 0,
                    padding: "12px 18px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  ✗ Refuser
                </button>
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            color: "#475569",
            padding: 40,
          }}
        >
          Aucune réservation
        </div>
      )}
    </div>
  );
}
