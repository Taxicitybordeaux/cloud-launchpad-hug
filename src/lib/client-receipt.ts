// Génération PDF d'un reçu de course côté navigateur.
import jsPDF from "jspdf";
import type { ClientReservation } from "@/lib/client-reservations.functions";

const GOLD = "#C9A84C";
const DARK = "#0A0A0A";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    });
  } catch {
    return iso;
  }
}

export function downloadReceiptPDF(
  r: ClientReservation,
  client: { name: string; email: string; phone: string },
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(DARK);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TAXI CITY BORDEAUX", 40, 45);
  doc.setFontSize(10);
  doc.setTextColor("#E8C96D");
  doc.text("Reçu de course — Espace client VIP", 40, 65);

  // Reference
  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Reçu de course", 40, 130);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#555");
  doc.text(`Référence : ${(r.tracking_id || r.id).slice(0, 12).toUpperCase()}`, 40, 150);
  doc.text(`Émis le : ${new Date().toLocaleString("fr-FR")}`, 40, 165);

  // Divider
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1.2);
  doc.line(40, 180, W - 40, 180);

  // Client info
  let y = 210;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text("Client", 40, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#333");
  y += 18;
  doc.text(client.name || "—", 40, y);
  y += 14;
  doc.text(client.email || "—", 40, y);
  y += 14;
  doc.text(client.phone || "—", 40, y);

  // Course info
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text("Détails de la course", 40, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#333");
  y += 18;
  doc.text(`Date / heure : ${fmtDate(r.pickup_datetime)}`, 40, y);
  y += 14;
  const dest = r.arrivee || r.destination || "—";
  doc.text(`Départ : ${r.depart || "—"}`, 40, y);
  y += 14;
  doc.text(`Arrivée : ${dest}`, 40, y);
  y += 14;
  doc.text(`Passagers : ${r.nb_passagers ?? r.passagers ?? 1}`, 40, y);
  y += 14;
  doc.text(`Bagages : ${r.bagages ?? 0}`, 40, y);
  if (r.paiement) {
    y += 14;
    doc.text(`Paiement : ${r.paiement}`, 40, y);
  }

  // Total box
  y += 36;
  doc.setFillColor("#FAF6E8");
  doc.rect(40, y, W - 80, 60, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text("Montant TTC", 60, y + 25);
  doc.setFontSize(20);
  doc.setTextColor(GOLD);
  const amount = r.prix_estime != null ? `${Number(r.prix_estime).toFixed(2)} €` : "—";
  doc.text(amount, W - 60, y + 35, { align: "right" });

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor("#888");
  doc.text(
    "Taxi City Bordeaux — taxi.city033@gmail.com — 06 73 07 23 22",
    W / 2,
    800,
    { align: "center" },
  );

  const fname = `recu-taxicity-${(r.tracking_id || r.id).slice(0, 8)}.pdf`;
  doc.save(fname);
}

export function exportReservationsCSV(rows: ClientReservation[]) {
  const headers = [
    "Date",
    "Reference",
    "Depart",
    "Arrivee",
    "Passagers",
    "Bagages",
    "Statut",
    "Montant_EUR",
    "Paiement",
  ];
  const lines = [headers.join(";")];
  for (const r of rows) {
    const dest = r.arrivee || r.destination || "";
    const cells = [
      new Date(r.pickup_datetime).toISOString(),
      r.tracking_id || r.id,
      r.depart || "",
      dest,
      String(r.nb_passagers ?? r.passagers ?? 1),
      String(r.bagages ?? 0),
      r.status,
      r.prix_estime != null ? Number(r.prix_estime).toFixed(2) : "",
      r.paiement || "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cells.join(";"));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historique-taxicity-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
