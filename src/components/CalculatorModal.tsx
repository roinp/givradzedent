"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/format";
import { useDraft } from "@/lib/useDraft";
import { buildQuoteHtml, emptyRow, rowTotal, type Quote, type Row } from "@/lib/quote";
import Modal from "./Modal";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Quick price calculator: treatments × quantity × price, minus a percentage discount. */
export default function CalculatorModal({ onClose }: { onClose: () => void }) {
  const draft = useDraft("calculator", { patient: "", discount: "", rows: [emptyRow()] });
  const { value, setValue } = draft;
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [patientNames, setPatientNames] = useState<string[]>([]);

  // Names of treatments done before and of patients, offered as suggestions.
  useEffect(() => {
    supabase
      .from("treatments")
      .select("procedure")
      .limit(1000)
      .then(({ data }) => setSuggestions([...new Set((data ?? []).map((t) => t.procedure.trim()))].sort()));
    supabase
      .from("patients")
      .select("first_name, last_name")
      .order("last_name")
      .limit(2000)
      .then(({ data }) => setPatientNames((data ?? []).map((p) => `${p.first_name} ${p.last_name}`)));
  }, []);

  const setRow = (i: number, patch: Partial<Row>) =>
    setValue({ ...value, rows: value.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const addRow = () => setValue({ ...value, rows: [...value.rows, emptyRow()] });
  const removeRow = (i: number) =>
    setValue({ ...value, rows: value.rows.length > 1 ? value.rows.filter((_, j) => j !== i) : [emptyRow()] });

  const subtotal = round2(value.rows.reduce((s, r) => s + rowTotal(r), 0));
  const percent = Math.min(100, Math.max(0, Number(value.discount) || 0));
  const discountAmount = round2((subtotal * percent) / 100);
  const total = round2(subtotal - discountAmount);
  const printableRows = value.rows.filter((r) => r.name.trim() || Number(r.price));

  function print() {
    printQuote({
      patient: value.patient.trim(),
      rows: printableRows,
      subtotal,
      percent,
      discountAmount,
      total,
    });
  }

  return (
    <Modal title="🧮 კალკულაცია" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="min-w-48 flex-1">
            <label className="label">პაციენტი (ბეჭდვისთვის)</label>
            <input
              className="input"
              list="calc-patients"
              placeholder="სახელი, გვარი"
              value={value.patient}
              onChange={(e) => setValue({ ...value, patient: e.target.value })}
            />
            <datalist id="calc-patients">
              {patientNames.map((n, i) => (
                <option key={i} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">ფასდაკლება</label>
            <div className="relative w-32">
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                className="input pr-8 tabular-nums"
                placeholder="0"
                value={value.discount}
                onChange={(e) => setValue({ ...value, discount: e.target.value })}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">%</span>
            </div>
          </div>
        </div>

        <datalist id="calc-treatments">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div>
          <div className="hidden grid-cols-[1fr_80px_100px_100px_32px] gap-2 px-1 pb-1 text-xs font-medium text-slate-500 sm:grid">
            <span>დასახელება</span>
            <span>რაოდენობა</span>
            <span>ფასი (₾)</span>
            <span className="text-right">ჯამი</span>
            <span />
          </div>
          <div className="space-y-2">
            {value.rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[1fr_80px_100px_100px_32px] sm:border-0 sm:p-0"
              >
                <input
                  className="input col-span-4 sm:col-span-1"
                  list="calc-treatments"
                  placeholder="მკურნალობა"
                  value={r.name}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input tabular-nums"
                  placeholder="1"
                  title="ცარიელი = 1"
                  value={r.qty}
                  onChange={(e) => setRow(i, { qty: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input tabular-nums"
                  placeholder="0.00"
                  value={r.price}
                  onChange={(e) => setRow(i, { price: e.target.value })}
                  onKeyDown={(e) => {
                    // Enter in the last price field adds a new row.
                    if (e.key === "Enter" && i === value.rows.length - 1) {
                      e.preventDefault();
                      addRow();
                    }
                  }}
                />
                <div className="flex items-center justify-end rounded-lg bg-slate-50 px-2 text-sm font-semibold tabular-nums">
                  {rowTotal(r).toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="წაშლა"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary mt-3" onClick={addRow}>
            + რიგის დამატება
          </button>
        </div>

        <div className="ml-auto max-w-xs space-y-1.5 rounded-lg border border-slate-200 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">ჯამი</span>
            <span className="tabular-nums">{formatPrice(subtotal)}</span>
          </div>
          {percent > 0 && (
            <div className="flex justify-between text-red-600">
              <span>ფასდაკლება ({percent}%)</span>
              <span className="tabular-nums">−{formatPrice(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold">
            <span>გადასახდელი</span>
            <span className="tabular-nums text-teal-700">{formatPrice(total)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary text-red-600" onClick={draft.reset}>
            გასუფთავება
          </button>
          <button type="button" className="btn-secondary mr-auto sm:order-first" onClick={onClose}>
            დახურვა
          </button>
          <button type="button" className="btn-primary" disabled={printableRows.length === 0} onClick={print}>
            🖨 ბეჭდვა
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Prints the estimate through a hidden iframe (no new tab). */
function printQuote(q: Quote) {
  const html = buildQuoteHtml(q);
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  // Give the fonts a moment to load, then print and clean up.
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 300);
}
