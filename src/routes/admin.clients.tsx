import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientRowSkeleton, SkeletonStyles } from "@/components/admin/Skeleton";

export const Route = createFileRoute("/admin/clients")({
  head: () => ({ meta: [{ title: "Clients — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ClientsPage,
});

/** Carte avec swipe-to-delete (glisser vers la gauche pour révéler le bouton supprimer) */
function SwipeRow({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const REVEAL = 88;
  const open = dx <= -REVEAL / 2;
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 20 }}>
      <button
        onClick={onDelete}
        aria-label="Supprimer"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: REVEAL,
          background: "#ef4444",
          color: "#fff",
          border: 0,
          fontSize: 22,
          cursor: "pointer",
          fontWeight: 700,
          borderRadius: "0 20px 20px 0",
        }}
      >
        🗑
      </button>
      <div
        onTouchStart={(e) => { startX.current = e.touches[0].clientX - dx; }}
        onTouchMove={(e) => {
          if (startX.current === null) return;
          const next = e.touches[0].clientX - startX.current;
          if (next <= 0 && next >= -REVEAL) setDx(next);
        }}
        onTouchEnd={() => {
          setDx(dx < -REVEAL / 2 ? -REVEAL : 0);
          startX.current = null;
        }}
        onMouseDown={(e) => { startX.current = e.clientX - dx; }}
        onMouseMove={(e) => {
          if (startX.current === null || e.buttons !== 1) return;
          const next = e.clientX - startX.current;
          if (next <= 0 && next >= -REVEAL) setDx(next);
        }}
        onMouseUp={() => {
          if (startX.current !== null) {
            setDx(dx < -REVEAL / 2 ? -REVEAL : 0);
            startX.current = null;
          }
        }}
        onClick={() => { if (open) setDx(0); }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: startX.current === null ? "transform 0.2s ease" : "none",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: 20,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [coursesByClient, setCoursesByClient] = useState<Record<string, any[]>>({});
  const [reservByClient, setReservByClient] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [addForm, setAddForm] = useState<Record<string, { destination: string; prix: string; paiement: string }>>({});

  const fetchAll = useCallback(async () => {
    const [{ data: cli }, { data: cou }, { data: res }] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("courses").select("*").order("created_at", { ascending: false }),
      supabase.from("reservations").select("*").order("created_at", { ascending: false }),
    ]);
    setClients(cli ?? []);
    const cbc: Record<string, any[]> = {};
    (cou ?? []).forEach((c: any) => {
      if (!c.client_id) return;
      (cbc[c.client_id] ||= []).push(c);
    });
    setCoursesByClient(cbc);
    // index reservations by client phone/email/name to enrich client cards
    const rbc: Record<string, any[]> = {};
    const cliByKey: Record<string, string> = {};
    (cli ?? []).forEach((c: any) => {
      if (c.phone) cliByKey[c.phone] = c.id;
      if (c.email) cliByKey[(c.email || "").toLowerCase()] = c.id;
    });
    (res ?? []).forEach((r: any) => {
      const key = r.telephone || (r.email || "").toLowerCase();
      const cid = cliByKey[key];
      if (cid) (rbc[cid] ||= []).push(r);
    });
    setReservByClient(rbc);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleHist = (id: string) => setOpen(o => ({ ...o, [id]: !o[id] }));

  const addCourse = async (c: any) => {
    const f = addForm[c.id] || { destination: "", prix: "", paiement: "especes" };
    if (!f.destination || !f.prix) return;
    await supabase.from("courses").insert({ client_id: c.id, destination: f.destination, prix_final: Number(f.prix), paiement: f.paiement, status: "terminee" });
    await supabase.from("clients").update({ total_courses: (c.total_courses ?? 0) + 1, total_depense: Number(c.total_depense ?? 0) + Number(f.prix) }).eq("id", c.id);
    setAddForm(a => ({ ...a, [c.id]: { destination: "", prix: "", paiement: "especes" } }));
    fetchAll();
  };

  const deleteClient = async (id: string) => {
    if (!confirm("Supprimer ce client ?")) return;
    await supabase.from("clients").delete().eq("id", id);
    fetchAll();
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
      <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 12 }}>👉 Glissez une carte vers la gauche pour supprimer</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, margin: "16px 0" }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}><div style={{ color: "#64748b", fontSize: 12 }}>Total clients</div><div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>{clients.length}</div></div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}><div style={{ color: "#64748b", fontSize: 12 }}>CA cumulé</div><div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>{totalCA.toFixed(2)} €</div></div>
        {fidele && <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}><div style={{ color: "#64748b", fontSize: 12 }}>Plus fidèle</div><div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>{fidele.name} <span style={{ color: "#0ea5e9", fontSize: 13 }}>({fidele.total_courses ?? 0})</span></div></div>}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher nom / téléphone / email" style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#fff", fontSize: 14, marginBottom: 16 }} />

      <SkeletonStyles />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
        {loading && Array.from({ length: 6 }).map((_, i) => <ClientRowSkeleton key={i} />)}
        {!loading && filtered.map(c => {
          const courses = coursesByClient[c.id] ?? [];
          const reservs = reservByClient[c.id] ?? [];
          const lastCourse = courses[0];
          const lastReserv = reservs[0];
          const lastPrix = lastCourse?.prix_final ?? lastReserv?.prix_estime;
          const lastDepart = lastCourse?.depart ?? lastReserv?.depart;
          const lastDest = lastCourse?.destination ?? lastReserv?.destination ?? lastReserv?.arrivee;
          return (
            <SwipeRow key={c.id} onDelete={() => deleteClient(c.id)}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, background: "#0ea5e9", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontFamily: "'Syne',sans-serif", flexShrink: 0 }}>{(c.name || "?")[0]?.toUpperCase()}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "#f8fafc", fontSize: 16 }}>{c.name}</div>
                  {c.phone && <div style={{ color: "#cbd5e1", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>📞 <a href={`tel:${c.phone}`} style={{ color: "#cbd5e1", textDecoration: "none" }}>{c.phone}</a></div>}
                  {c.email && <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>✉️ <a href={`mailto:${c.email}`} style={{ color: "#94a3b8", textDecoration: "none" }}>{c.email}</a></div>}
                </div>
              </div>

              <div style={{ marginTop: 10, padding: 10, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: 10, fontSize: 12, color: "#cbd5e1" }}>
                {lastPrix != null ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10, fontWeight: 700 }}>Dernière course</span>
                      <span style={{ color: "#0ea5e9", fontWeight: 800, fontSize: 14 }}>{Number(lastPrix).toFixed(2)} €</span>
                    </div>
                    {lastDepart && <div>🟢 <strong>De :</strong> {lastDepart}</div>}
                    {lastDest && <div>🔴 <strong>À :</strong> {lastDest}</div>}
                  </>
                ) : (
                  <span style={{ color: "#64748b" }}>Aucune course enregistrée</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 13, color: "#cbd5e1" }}>
                <span>🚗 {c.total_courses ?? 0} courses</span>
                <span>💶 {Number(c.total_depense ?? 0).toFixed(2)} €</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => toggleHist(c.id)} style={{ flex: 1, background: "rgba(14,165,233,0.15)", color: "#0ea5e9", border: 0, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{open[c.id] ? "Masquer" : "Voir historique"}</button>
              </div>
              {open[c.id] && (
                <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                  {courses.map((co, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#94a3b8", padding: "4px 0" }}>{new Date(co.created_at).toLocaleDateString("fr-FR")} — {co.destination} — <b style={{ color: "#0ea5e9" }}>{Number(co.prix_final).toFixed(2)} €</b> ({co.paiement})</div>
                  ))}
                  {courses.length === 0 && <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: 8 }}>Aucune course</div>}
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
            </SwipeRow>
          );
        })}
      </div>
    </div>
  );
}
