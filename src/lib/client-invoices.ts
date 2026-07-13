// Génération PDF de factures mensuelles / annuelles pour l'espace client.
// Réutilise jsPDF. TVA française taxi : 10 % par défaut.
import jsPDF from "jspdf";
import type { InvoiceRow, CompanyInfo } from "@/lib/client-billing.functions";

const GOLD = "#C9A84C";
const DARK = "#0A0A0A";
const VAT_RATE = 0.1; // TVA 10 % transport de personnes

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  } catch {
    return iso;
  }
}

function fmtEUR(n: number) {
  return n.toFixed(2).replace(".", ",") + " €";
}

function header(doc: jsPDF, W: number, title: string, sub: string) {
  doc.setFillColor(DARK);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TAXI CITY BORDEAUX", 40, 45);
  doc.setFontSize(10);
  doc.setTextColor("#E8C96D");
  doc.text(sub, 40, 65);

  doc.setTextColor(DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 40, 130);
  doc.setDrawColor(GOLD);
  doc.setLineWidth(1.2);
  doc.line(40, 145, W - 40, 145);
}

function clientBlock(doc: jsPDF, y: number, client: { name: string; email: string; phone: string }, company: CompanyInfo) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text("Facturé à", 40, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#333");
  let yy = y + 18;
  if (company.company_name) {
    doc.setFont("helvetica", "bold");
    doc.text(company.company_name, 40, yy);
    doc.setFont("helvetica", "normal");
    yy += 14;
  }
  doc.text(client.name || "—", 40, yy); yy += 14;
  if (company.billing_address) {
    for (const line of company.billing_address.split("\n").slice(0, 3)) {
      doc.text(line, 40, yy); yy += 14;
    }
  }
  doc.text(client.email || "—", 40, yy); yy += 14;
  doc.text(client.phone || "—", 40, yy); yy += 14;
  if (company.siret) { doc.text(`SIRET : ${company.siret}`, 40, yy); yy += 14; }
  if (company.tva_intracom) { doc.text(`TVA : ${company.tva_intracom}`, 40, yy); yy += 14; }
  return yy;
}

function emitterBlock(doc: jsPDF, W: number, y: number, invoiceNumber: string, period: string) {
  const x = W - 240;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text("Émetteur", x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#333");
  doc.text("Taxi City Bordeaux", x, y + 16);
  doc.text("33000 Bordeaux", x, y + 28);
  doc.text("taxi.city033@gmail.com", x, y + 40);
  doc.text("06 73 07 23 22", x, y + 52);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Facture n° ${invoiceNumber}`, x, y + 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Période : ${period}`, x, y + 92);
  doc.text(`Émise le : ${new Date().toLocaleDateString("fr-FR")}`, x, y + 104);
}

function table(doc: jsPDF, W: number, startY: number, rows: InvoiceRow[]) {
  const cols = [
    { label: "Date", x: 40, w: 70 },
    { label: "Référence", x: 110, w: 80 },
    { label: "Trajet", x: 190, w: 270 },
    { label: "Montant TTC", x: 460, w: 95 },
  ];
  doc.setFillColor("#FAF6E8");
  doc.rect(40, startY - 14, W - 80, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(DARK);
  for (const c of cols) doc.text(c.label, c.x + 4, startY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#333");
  let y = startY + 20;
  for (const r of rows) {
    if (y > 760) {
      doc.addPage();
      y = 60;
    }
    const trajet = `${r.depart} → ${r.arrivee}`;
    doc.text(fmtDate(r.date), 44, y);
    doc.text(r.reference, 114, y);
    const t = trajet.length > 58 ? trajet.slice(0, 57) + "…" : trajet;
    doc.text(t, 194, y);
    doc.text(fmtEUR(r.prix_estime), 555, y, { align: "right" });
    y += 16;
  }
  return y;
}

function totals(doc: jsPDF, W: number, y: number, totalTTC: number) {
  const ht = totalTTC / (1 + VAT_RATE);
  const tva = totalTTC - ht;
  y += 16;
  doc.setDrawColor("#E2D9B0");
  doc.line(W - 240, y, W - 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#333");
  doc.text("Total HT", W - 240, y);
  doc.text(fmtEUR(ht), W - 40, y, { align: "right" });
  y += 14;
  doc.text(`TVA ${(VAT_RATE * 100).toFixed(0)} %`, W - 240, y);
  doc.text(fmtEUR(tva), W - 40, y, { align: "right" });
  y += 18;
  doc.setFillColor("#FAF6E8");
  doc.rect(W - 240, y - 14, 200, 32, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(DARK);
  doc.text("Total TTC", W - 232, y + 6);
  doc.setTextColor(GOLD);
  doc.setFontSize(14);
  doc.text(fmtEUR(totalTTC), W - 48, y + 8, { align: "right" });
  return y + 30;
}

function footer(doc: jsPDF, W: number) {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor("#888");
  doc.text(
    "Taxi City Bordeaux — taxi.city033@gmail.com — 06 73 07 23 22 — TVA 10 % incluse",
    W / 2,
    810,
    { align: "center" },
  );
}

function makeInvoiceNumber(accountId: string, period: string) {
  const hash = accountId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `TC-${period}-${hash}`;
}

export function downloadMonthlyInvoicePDF(opts: {
  accountId: string;
  year: number;
  month: number; // 1-12
  rows: InvoiceRow[];
  client: { name: string; email: string; phone: string };
  company: CompanyInfo;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const period = `${opts.year}-${String(opts.month).padStart(2, "0")}`;
  const periodLabel = new Date(opts.year, opts.month - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const invoiceNumber = makeInvoiceNumber(opts.accountId, period);

  header(doc, W, `Facture mensuelle — ${periodLabel}`, "Récapitulatif fiscal pour notes de frais");
  const afterClient = clientBlock(doc, 175, opts.client, opts.company);
  emitterBlock(doc, W, 175, invoiceNumber, periodLabel);
  let y = Math.max(afterClient, 310);
  y = table(doc, W, y + 10, opts.rows);
  const totalTTC = opts.rows.reduce((s, r) => s + r.prix_estime, 0);
  totals(doc, W, y, totalTTC);
  footer(doc, W);

  doc.save(`facture-taxicity-${period}.pdf`);
}

export function downloadYearlyInvoicePDF(opts: {
  accountId: string;
  year: number;
  rows: InvoiceRow[];
  client: { name: string; email: string; phone: string };
  company: CompanyInfo;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const period = `${opts.year}`;
  const invoiceNumber = makeInvoiceNumber(opts.accountId, `Y${period}`);

  header(doc, W, `Récapitulatif annuel — ${opts.year}`, "Document fiscal — bilan annuel");
  const afterClient = clientBlock(doc, 175, opts.client, opts.company);
  emitterBlock(doc, W, 175, invoiceNumber, `Année ${opts.year}`);
  let y = Math.max(afterClient, 310);
  y = table(doc, W, y + 10, opts.rows);
  const totalTTC = opts.rows.reduce((s, r) => s + r.prix_estime, 0);
  totals(doc, W, y, totalTTC);
  footer(doc, W);

  doc.save(`recap-annuel-taxicity-${period}.pdf`);
}
