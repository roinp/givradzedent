import { CLINIC_BRAND } from "@/lib/medicalCard";
import { escapeHtml } from "@/lib/print";
import { formatDateShort } from "@/lib/format";

/** `date` (YYYY-MM-DD), `patient`, `discount` (%) and `paid` are only used by lab orders, where each row belongs to its own patient. */
export type Row = {
  name: string;
  qty: string;
  price: string;
  date?: string;
  patient?: string;
  discount?: string;
  paid?: string;
};

export const emptyRow = (): Row => ({ name: "", qty: "", price: "" });

/** Empty quantity counts as 1. */
export const qtyOf = (r: Row) => (r.qty.trim() === "" ? 1 : Number(r.qty) || 0);
export const rowGross = (r: Row) => qtyOf(r) * (Number(r.price) || 0);
export const rowPercent = (r: Row) => Math.min(100, Math.max(0, Number(r.discount) || 0));
/** Row sum after its own % discount. */
export const rowTotal = (r: Row) => Math.round(rowGross(r) * (100 - rowPercent(r))) / 100;
export const rowPaid = (r: Row) => Number(r.paid) || 0;


export type Quote = {
  patient: string;
  rows: Row[];
  subtotal: number;
  percent: number;
  discountAmount: number;
  total: number;
  paid: number;
  remaining: number;
};

export type QuoteLabels = {
  title: string;
  itemHeader: string;
  note: string | null;
  dateColumn?: boolean;
  patientColumn?: boolean;
  discountColumn?: boolean;
  paidColumn?: boolean;
  noSignatures?: boolean;
};

const DEFAULT_LABELS: QuoteLabels = {
  title: "მკურნალობის ხარჯთაღრიცხვა",
  itemHeader: "მკურნალობა / მომსახურება",
  note: "ხარჯთაღრიცხვა წინასწარია და შეიძლება შეიცვალოს მკურნალობის მიმდინარეობისას.",
};

/** A4 cost-estimate page for the patient. */
export function buildQuoteHtml(q: Quote, labels: QuoteLabels = DEFAULT_LABELS) {
  const money = (n: number) => `${n.toFixed(2)} ₾`;
  const today = new Date();
  const date = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
  const rows = q.rows
    .map(
      (r, i) => `<tr>
        <td class="c">${i + 1}</td>
        ${labels.dateColumn ? `<td class="c">${r.date ? formatDateShort(r.date) : "—"}</td>` : ""}
        ${labels.patientColumn ? `<td>${escapeHtml(r.patient?.trim() || "—")}</td>` : ""}
        <td>${escapeHtml(r.name || "—")}</td>
        <td class="c">${qtyOf(r)}</td>
        <td class="r">${money(Number(r.price) || 0)}</td>
        ${labels.discountColumn ? `<td class="c">${rowPercent(r) ? `${rowPercent(r)}%` : "—"}</td>` : ""}
        <td class="r">${money(rowTotal(r))}</td>
        ${labels.paidColumn ? `<td class="r">${money(rowPaid(r))}</td>` : ""}
      </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="ka"><head><meta charset="utf-8"><title>${escapeHtml(labels.title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: Sylfaen, "Noto Sans Georgian", "DejaVu Sans", sans-serif; font-size: 11pt; color: #000; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0d9488; padding-bottom: 8pt; }
  .brand { font-size: 18pt; font-weight: bold; color: #0d9488; letter-spacing: .5pt; }
  .sub { font-size: 9pt; color: #555; }
  h1 { font-size: 14pt; text-align: center; margin: 18pt 0 12pt; }
  .meta { margin-bottom: 12pt; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 5pt 7pt; vertical-align: top; }
  th { background: #f1f5f9; font-weight: bold; text-align: left; }
  .c { text-align: center; } .r { text-align: right; white-space: nowrap; }
  .totals { margin: 12pt 0 0 auto; width: 55%; }
  .totals td { border: none; padding: 3pt 7pt; }
  .totals .disc td { color: #b91c1c; }
  .totals .final td { border-top: 2px solid #000; font-size: 13pt; font-weight: bold; padding-top: 6pt; }
  .sign { margin-top: 40pt; display: flex; justify-content: space-between; font-size: 10pt; }
  .note { margin-top: 24pt; font-size: 9pt; color: #555; }
</style></head><body>
  <div class="head">
    <div><div class="brand">🦷 ${escapeHtml(CLINIC_BRAND)}</div><div class="sub">სტომატოლოგიური კლინიკა</div></div>
    <div class="sub">თარიღი: ${date}</div>
  </div>
  <h1>${escapeHtml(labels.title)}</h1>
  ${labels.patientColumn ? "" : `<div class="meta">პაციენტი: <b>${q.patient ? escapeHtml(q.patient) : "______________________________"}</b></div>`}
  <table>
    <thead><tr><th class="c" style="width:7%">№</th>${labels.dateColumn ? '<th class="c" style="width:12%">თარიღი</th>' : ""}${labels.patientColumn ? '<th style="width:24%">პაციენტი</th>' : ""}<th>${escapeHtml(labels.itemHeader)}</th><th class="c" style="width:12%">რაოდენობა</th><th class="r" style="width:16%">ფასი</th>${labels.discountColumn ? '<th class="c" style="width:10%">ფასდ.</th>' : ""}<th class="r" style="width:17%">ჯამი</th>${labels.paidColumn ? '<th class="r" style="width:16%">გადახდილი</th>' : ""}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>ჯამი</td><td class="r">${money(q.subtotal)}</td></tr>
    ${q.discountAmount > 0 ? `<tr class="disc"><td>ფასდაკლება${q.percent > 0 ? ` (${q.percent}%)` : ""}</td><td class="r">−${money(q.discountAmount)}</td></tr>` : ""}
    <tr class="final"><td>გადასახდელი</td><td class="r">${money(q.total)}</td></tr>
    ${labels.paidColumn ? `<tr><td>გადახდილი</td><td class="r">${money(q.paid)}</td></tr><tr class="disc"><td><b>დარჩენილი</b></td><td class="r"><b>${money(q.remaining)}</b></td></tr>` : ""}
  </table>
  ${labels.note ? `<p class="note">${escapeHtml(labels.note)}</p>` : ""}
  ${labels.noSignatures ? "" : '<div class="sign"><span>ექიმი: ____________________</span><span>პაციენტი: ____________________</span></div>'}
</body></html>`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Totals for a calculation; rows without a name or price are left out. */
export function computeQuote(patient: string, discount: string | number, rows: Row[]): Quote {
  const used = rows.filter((r) => r.name.trim() || r.patient?.trim() || Number(r.price) || rowPaid(r));
  // Subtotal is before any discount; per-row discounts come first, then the overall %.
  const subtotal = round2(used.reduce((s, r) => s + rowGross(r), 0));
  const afterRows = round2(used.reduce((s, r) => s + rowTotal(r), 0));
  const percent = Math.min(100, Math.max(0, Number(discount) || 0));
  const total = round2(afterRows - (afterRows * percent) / 100);
  const discountAmount = round2(subtotal - total);
  const paid = round2(used.reduce((s, r) => s + rowPaid(r), 0));
  return { patient: patient.trim(), rows: used, subtotal, percent, discountAmount, total, paid, remaining: round2(total - paid) };
}
