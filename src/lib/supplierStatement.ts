import { CLINIC_BRAND } from "@/lib/medicalCard";
import { formatDateShort, todayISO } from "@/lib/format";
import { escapeHtml } from "@/lib/print";
import type { Expense, ExpensePayment } from "@/lib/types";

/** A4 statement for one company: its purchases and payments with dates, and the balance. */
export function buildSupplierStatementHtml(s: {
  name: string | null;
  expenses: Expense[];
  payments: ExpensePayment[];
}) {
  const money = (n: number) => `${n.toFixed(2)} ₾`;
  const byDate = <T extends { date: string }>(list: T[]) => [...list].sort((a, b) => a.date.localeCompare(b.date));
  const expenses = byDate(s.expenses);
  const payments = byDate(s.payments);
  const totalOf = (e: Expense) => Number(e.unit_price) * Number(e.quantity);
  const total = expenses.reduce((sum, e) => sum + totalOf(e), 0);
  // Legacy per-purchase "paid" values count too, as on the expenses page.
  const legacyPaid = expenses.reduce((sum, e) => sum + Number(e.paid), 0);
  const paid = legacyPaid + payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = total - paid;

  const expenseRows = expenses
    .map(
      (e, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="c">${formatDateShort(e.date)}</td>
        <td>${escapeHtml(e.item)}${e.category ? ` <span class="muted">(${escapeHtml(e.category)})</span>` : ""}</td>
        <td class="c">${Number(e.quantity)}</td>
        <td class="r">${money(Number(e.unit_price))}</td>
        <td class="r">${money(totalOf(e))}</td>
      </tr>`,
    )
    .join("");
  const paymentRows = payments
    .map(
      (p, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="c">${formatDateShort(p.date)}</td>
        <td>${p.notes ? escapeHtml(p.notes) : "—"}</td>
        <td class="r">${money(Number(p.amount))}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="ka"><head><meta charset="utf-8"><title>${escapeHtml(s.name ?? "კომპანია")}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: Sylfaen, "Noto Sans Georgian", "DejaVu Sans", sans-serif; font-size: 11pt; color: #000; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0d9488; padding-bottom: 8pt; }
  .brand { font-size: 18pt; font-weight: bold; color: #0d9488; letter-spacing: .5pt; }
  .sub, .muted { font-size: 9pt; color: #555; }
  h1 { font-size: 14pt; text-align: center; margin: 18pt 0 4pt; }
  .company { text-align: center; font-size: 13pt; font-weight: bold; margin-bottom: 14pt; }
  h2 { font-size: 12pt; margin: 16pt 0 6pt; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 5pt 7pt; vertical-align: top; }
  th { background: #f1f5f9; font-weight: bold; text-align: left; }
  .c { text-align: center; white-space: nowrap; } .r { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: bold; background: #f8fafc; }
  .empty { color: #555; font-style: italic; }
  .totals { margin: 16pt 0 0 auto; width: 55%; }
  .totals td { border: none; padding: 3pt 7pt; }
  .totals .paid td { color: #047857; }
  .totals .final td { border-top: 2px solid #000; font-size: 13pt; font-weight: bold; padding-top: 6pt; }
  .totals .debt td { color: #b91c1c; }
</style></head><body>
  <div class="head">
    <div><div class="brand">🦷 ${escapeHtml(CLINIC_BRAND)}</div><div class="sub">სტომატოლოგიური კლინიკა</div></div>
    <div class="sub">თარიღი: ${formatDateShort(todayISO())}</div>
  </div>
  <h1>შესყიდვები და გადახდები</h1>
  <div class="company">🏢 ${escapeHtml(s.name ?? "კომპანიის გარეშე")}</div>

  <h2>შესყიდვები</h2>
  ${
    expenses.length
      ? `<table>
    <thead><tr><th class="c" style="width:6%">№</th><th class="c" style="width:14%">თარიღი</th><th>დასახელება</th><th class="c" style="width:10%">რაოდ.</th><th class="r" style="width:15%">ფასი</th><th class="r" style="width:16%">ჯამი</th></tr></thead>
    <tbody>${expenseRows}</tbody>
    <tfoot><tr><td colspan="5">სულ</td><td class="r">${money(total)}</td></tr></tfoot>
  </table>`
      : `<p class="empty">შესყიდვები არ არის</p>`
  }

  <h2>გადახდები</h2>
  ${
    payments.length
      ? `<table>
    <thead><tr><th class="c" style="width:6%">№</th><th class="c" style="width:14%">თარიღი</th><th>შენიშვნა</th><th class="r" style="width:18%">თანხა</th></tr></thead>
    <tbody>${paymentRows}</tbody>
    <tfoot><tr><td colspan="3">სულ</td><td class="r">${money(paid - legacyPaid)}</td></tr></tfoot>
  </table>`
      : `<p class="empty">გადახდა ჯერ არ ყოფილა</p>`
  }

  <table class="totals">
    <tr><td>სულ შესყიდვები</td><td class="r">${money(total)}</td></tr>
    <tr class="paid"><td>გადახდილი</td><td class="r">${money(paid)}</td></tr>
    <tr class="final${remaining > 0.005 ? " debt" : ""}"><td>დარჩენილი</td><td class="r">${money(remaining)}</td></tr>
  </table>
</body></html>`;
}
