import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculerPrix } from "@/lib/tarif";

export const Route = createFileRoute("/admin/courses")({
  head: () => ({ meta: [{ title: "Courses — Admin" }, { name: "robots", content: "noindex" }] }),
  component: CoursesPage,
});

type R = any;
const tabKeys = ["pending", "accepted", "refused"] as const;
const tabLabels: Record<string, string> = { pending: "En attente", accepted: "Acceptées", refused: "Refusées" };

function CoursesPage() {
  const [tab, setTab] = useState<typeof tabKeys[number]>("pending");
  const [items, setItems] = useState<R[]>([]);
  const [simKm, setSimKm] = useState(5);
  const [simJour, setSimJour] = useState(true);
  const [simOpen, setSimOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({ pending: 0, accepted: 0, refused: 0 });
  const initialLoad = useRef(true);

  const fetchAll = useCallback(async () => {
    const { data } = await supabase.from("reservations").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    const c: Record<string, number> = { pending: 0, accepted: 0, refused: 0 };
    (data ?? []).forEach((r: R) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    setCounts(c);
  }, []);

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel("courses-rt").on("postgres_changes", { event: "INSERT", schema: "public", table: "reservations" }, (payload) => {
      if (!initialLoad.current) {
        const n = payload.new as R;
        try { new Audio("/notification.mp3").play().catch(() => {}); } catch {}
        if (typeof window !== "undefined") {
          const t = document.createElement("div");
          t.textContent = `🔔 Nouvelle réservation de ${n.client_name || n.nom}!`;
          t.style.cssText = "position:fixed;top:20px;right:20px;background:#0ea5e9;color:#fff;padding:14px 20px;border-radius:12px;font-family:DM Sans,sans-serif;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.3)";
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 5000);
        }
      }
      fetchAll();
    }).on("postgres_changes", { event: "UPDATE", schema: "public", table: "reservations" }, fetchAll).subscribe();
    initialLoad.current = false;
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const handleAccept = async (r: R) => {
    await supabase.from("reservations").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", r.id);
    const phone = r.client_phone || r.telephone;
    const name = r.client_name || r.nom;
    const email = r.client_email || r.email;
    if (phone) {
      const { data: existing } = await supabase.from("clients").select("id, total_courses").eq("phone", phone).maybeSingle();
      if (existing) {
        await supabase.from("clients").update({ total_courses: (existing.total_courses ?? 0) + 1 }).eq("id", existing.id);
      } else {
        await supabase.from("clients").insert({ name, phone, email, total_courses: 1 });
      }
    }
    fetchAll();
  };

  const handleRefuse = async (r: R) => {
    await supabase.from("reservations").update({ status: "refused", updated_at: new Date().toISOString() }).eq("id", r.id);
    fetchAll();
  };

  const filtered = items.filter(r => r.status === tab);
  const simPrix = calculerPrix(simKm, simJour);

  return (
    <div style={{ padding: "32px 24px", fontFamily: "'DM Sans',sans-serif" }}>
      <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 30, fontWeight: 800, color: "#f8fafc", margin: 0, marginBottom: 20 }}>Courses</h1>

      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <button onClick={() => setSimOpen(o => !o)} style={{ background: "transparent", border: 0, color: "#0ea5e9", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          {simOpen ? "▼" : "▶"} Simulateur de tarif
        </button>
        {simOpen && (
          <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ color: "#cbd5e1", fontSize: 13 }}>Distance (km):
              <input type="number" value={simKm} onChange={e => setSimKm(Number(e.target.value))} step="0.1" style={{ marginLeft: 6, padding: "6px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 8, width: 90 }} />
            </label>
            <label style={{ color: "#cbd5e1", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={simJour} onChange={e => setSimJour(e.target.checked)} /> Tarif jour
            </label>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>2.83 + {simKm} × {simJour ? "2.16" : "3.24"} = <b style={{ color: "#0ea5e9" }}>{simPrix} €</b></span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabKeys.map(k => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 16px", background: tab === k ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${tab === k ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.08)"}`, color: tab === k ? "#0ea5e9" : "#94a3b8", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            {tabLabels[k]} <span style={{ background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 99, marginLeft: 6, fontSize: 11 }}>{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>

      {filtered.map(r => {
        const phone = r.client_phone || r.telephone;
        const email = r.client_email || r.email;
        const name = r.client_name || r.nom;
        const dest = r.destination || r.arrivee;
        const dateAff = r.date_course && r.heure_course ? `${r.date_course} ${r.heure_course}` : new Date(r.pickup_datetime || r.created_at).toLocaleString("fr-FR");
        const prix = r.prix_estime ?? (r.distance_km ? calculerPrix(Number(r.distance_km), r.tarif_jour ?? true) : null);
        return (
          <div key={r.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "#f8fafc", fontSize: 16 }}>{name}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#64748b", fontSize: 12 }}>{dateAff}</span>
                <span style={{ background: "rgba(14,165,233,0.15)", color: "#0ea5e9", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>{r.source ?? "form"}</span>
              </div>
            </div>
            <div style={{ marginTop: 10, color: "#cbd5e1", fontSize: 14 }}>🟢 {r.depart} → 📍 {dest}</div>
            <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 13, display: "flex", flexWrap: "wrap", gap: 12 }}>
              {r.distance_km && <span>{r.distance_km} km</span>}
              {prix && <span>≈ {Number(prix).toFixed(2)} €</span>}
              <span>👥 {r.nb_passagers ?? r.passagers ?? 1}</span>
              <span style={{ background: r.tarif_jour === false ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)", color: r.tarif_jour === false ? "#818cf8" : "#f59e0b", padding: "2px 8px", borderRadius: 99, fontSize: 11 }}>{r.tarif_jour === false ? "Nuit" : "Jour"}</span>
            </div>
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              {phone && <a href={`tel:${phone}`} style={{ color: "#0ea5e9", fontSize: 13, textDecoration: "none" }}>📞 {phone}</a>}
              {email && <a href={`mailto:${email}`} style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>✉️ {email}</a>}
            </div>
            {r.status === "pending" && (
              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                <button onClick={() => handleAccept(r)} style={{ background: "#22c55e", color: "#fff", border: 0, padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>✓ Accepter</button>
                <button onClick={() => handleRefuse(r)} style={{ background: "#ef4444", color: "#fff", border: 0, padding: "10px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>✗ Refuser</button>
              </div>
            )}
          </div>
        );
      })}
      {filtered.length === 0 && <div style={{ textAlign: "center", color: "#475569", padding: 40 }}>Aucune réservation</div>}
    </div>
  );
}
