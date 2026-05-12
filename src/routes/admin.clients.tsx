import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientRowSkeleton, SkeletonStyles } from "@/components/admin/Skeleton";

export const Route = createFileRoute("/admin/clients")({
  head: () => ({ meta: [{ title: "Clients — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [addForm, setAddForm] = useState<Record<string, { destination: string; prix: string; paiement: string }>>({});

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    setClients(data ?? []);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const toggleHist = async (id: string) => {
    setOpen(o => ({ ...o, [id]: !o[id] }));
    if (!history[id]) {
      const { data } = await supabase.from("courses").select("*").eq("client_id", id).order("created_at", { ascending: false });
      setHistory(h => ({ ...h, [id]: data ?? [] }));
    }
  };

  const addCourse = async (c: any) => {
    const f = addForm[c.id] || { destination: "", prix: "", paiement: "especes" };
    if (!f.destination || !f.prix) return;
    await supabase.from("courses").insert({ client_id: c.id, destination: f.destination, prix_final: Number(f.prix), paiement: f.paiement, status: "terminee" });
    await supabase.from("clients").update({ total_courses: (c.total_courses ?? 0) + 1, total_depense: Number(c.total_depense ?? 0) + Number(f.prix) }).eq("id", c.id);
    setAddForm(a => ({ ...a, [c.id]: { destination: "", prix: "", paiement: "especes" } }));
    setHistory(h => ({ ...h, [c.id]: undefined as any }));
    fetchClients();
  };

  const filtered = clients.filter(c => {
    const s = search.toLowerCase();
    return !s || c.name?.toLowerCase().includes(s) || c.phone?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
  });
  const totalCA = clients.reduce((s, c) => s + Number(c.total_depense ?? 0), 0);
  const fidele = [...clients].sort((a, b) => (b.total_courses ?? 0) - (a.total_courses ?? 0))[0];

  return (
    <div style={{ padding: "32px 24px", fontFamily: "'DM Sans',sans-serif" }}>
      <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 30, fontWeight: 800, color: "#f8fafc", margin: 0, marginBottom: 8 }}>Portefeuille clients <span style={{ background: "rgba(14,165,233,0.15)", color: "#0ea5e9", fontSize: 14, padding: "4px 12px", borderRadius: 99, marginLeft: 10 }}>{clients.length}</span></h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, margin: "16px 0" }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}><div style={{ color: "#64748b", fontSize: 12 }}>Total clients</div><div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>{clients.length}</div></div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}><div style={{ color: "#64748b", fontSize: 12 }}>CA cumulé</div><div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>{totalCA.toFixed(2)} €</div></div>
        {fidele && <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}><div style={{ color: "#64748b", fontSize: 12 }}>Plus fidèle</div><div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>{fidele.name} <span style={{ color: "#0ea5e9", fontSize: 13 }}>({fidele.total_courses ?? 0})</span></div></div>}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher nom / téléphone / email" style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#fff", fontSize: 14, marginBottom: 16 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {filtered.map(c => (
          <div key={c.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, background: "#0ea5e9", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>{(c.name || "?")[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "#f8fafc" }}>{c.name}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{c.phone || "—"}</div>
              </div>
            </div>
            {c.email && <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>✉️ {c.email}</div>}
            <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 13, color: "#cbd5e1" }}>
              <span>🚗 {c.total_courses ?? 0}</span>
              <span>💶 {Number(c.total_depense ?? 0).toFixed(2)} €</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => toggleHist(c.id)} style={{ flex: 1, background: "rgba(14,165,233,0.15)", color: "#0ea5e9", border: 0, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{open[c.id] ? "Masquer" : "Voir historique"}</button>
            </div>
            {open[c.id] && (
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                {(history[c.id] ?? []).map((co, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#94a3b8", padding: "4px 0" }}>{new Date(co.created_at).toLocaleDateString("fr-FR")} — {co.destination} — <b style={{ color: "#0ea5e9" }}>{Number(co.prix_final).toFixed(2)} €</b> ({co.paiement})</div>
                ))}
                {(history[c.id] ?? []).length === 0 && <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: 8 }}>Aucune course</div>}
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <input placeholder="Destination" value={addForm[c.id]?.destination ?? ""} onChange={e => setAddForm(a => ({ ...a, [c.id]: { ...(a[c.id] ?? { destination: "", prix: "", paiement: "especes" }), destination: e.target.value } }))} style={{ padding: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", borderRadius: 8, fontSize: 12 }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <input placeholder="Prix €" value={addForm[c.id]?.prix ?? ""} onChange={e => setAddForm(a => ({ ...a, [c.id]: { ...(a[c.id] ?? { destination: "", prix: "", paiement: "especes" }), prix: e.target.value } }))} style={{ flex: 1, padding: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", borderRadius: 8, fontSize: 12 }} />
                    <select value={addForm[c.id]?.paiement ?? "especes"} onChange={e => setAddForm(a => ({ ...a, [c.id]: { ...(a[c.id] ?? { destination: "", prix: "", paiement: "especes" }), paiement: e.target.value } }))} style={{ padding: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", borderRadius: 8, fontSize: 12 }}>
                      <option value="especes">Espèces</option><option value="cb">CB</option>
                    </select>
                  </div>
                  <button onClick={() => addCourse(c)} style={{ background: "#22c55e", color: "#fff", border: 0, padding: 6, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>➕ Ajouter</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
