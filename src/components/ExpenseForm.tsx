"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayISO } from "@/lib/format";
import { useDraft } from "@/lib/useDraft";
import type { Expense } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";
import DateInput from "./DateInput";
import DraftNotice from "./DraftNotice";

export const EXPENSE_CATEGORIES = ["ინვენტარი", "იმპლანტი", "მასალა", "ხელსაწყო", "მედიკამენტი", "სხვა"];

export default function ExpenseForm({
  expense,
  defaultSupplier,
  suppliers,
  onClose,
  onSaved,
}: {
  expense?: Expense | null;
  defaultSupplier?: string | null;
  suppliers: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const draft = useDraft(`expense:${expense?.id ?? `new:${defaultSupplier ?? ""}`}`, {
    date: expense?.date ?? todayISO(),
    item: expense?.item ?? "",
    category: expense?.category ?? "",
    unit_price: expense ? String(expense.unit_price) : "",
    quantity: expense ? String(expense.quantity) : "1",
    supplier: expense?.supplier ?? defaultSupplier ?? "",
    paid: "",
    paid_date: todayISO(),
    notes: expense?.notes ?? "",
  });
  const { value: form, setValue: setForm } = draft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const round = (n: number) => Math.round(n * 100) / 100;
  const total = round((Number(form.unit_price) || 0) * (Number(form.quantity) || 0));
  const paidNow = Number(form.paid) || 0;

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Reuse the existing spelling of the company so the purchase lands in the same group.
    const typed = form.supplier.trim();
    const supplier = suppliers.find((s) => s.toLowerCase() === typed.toLowerCase()) ?? (typed || null);
    const payload = {
      date: form.date,
      item: form.item.trim(),
      category: form.category.trim() || null,
      unit_price: Number(form.unit_price) || 0,
      quantity: Number(form.quantity) || 0,
      supplier,
      notes: form.notes.trim() || null,
    };
    const { error } = expense
      ? await supabase.from("expenses").update(payload).eq("id", expense.id)
      : await supabase.from("expenses").insert(payload);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    if (!expense && paidNow > 0) {
      const res = await supabase
        .from("expense_payments")
        .insert({ supplier, date: form.paid_date, amount: paidNow, notes: payload.item });
      if (res.error) {
        setBusy(false);
        return setError(`შესყიდვა შეინახა, მაგრამ გადახდა ვერა: ${res.error.message}`);
      }
    }
    setBusy(false);
    draft.clear();
    onSaved();
  }

  return (
    <Modal title={expense ? "შესყიდვის რედაქტირება" : "ახალი შესყიდვა"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <DraftNotice restored={draft.restored} onReset={draft.reset} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">კომპანია (საიდანაც იყიდეთ)</label>
            <input
              className="input"
              list="expense-suppliers"
              value={form.supplier}
              onChange={set("supplier")}
              placeholder="აირჩიეთ არსებული ან ჩაწერეთ ახალი"
            />
            <datalist id="expense-suppliers">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="label">დასახელება *</label>
            <input
              required
              className="input"
              value={form.item}
              onChange={set("item")}
              placeholder="მაგ. იმპლანტი Straumann, ხელთათმანები"
            />
          </div>
          <div>
            <label className="label">კატეგორია</label>
            <input
              className="input"
              list="expense-categories"
              value={form.category}
              onChange={set("category")}
              placeholder="აირჩიეთ ან ჩაწერეთ"
            />
            <datalist id="expense-categories">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">შესყიდვის თარიღი *</label>
            <DateInput required value={form.date} onChange={(date) => setForm({ ...form, date })} />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label text-xs">ერთეულის ფასი (₾)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.unit_price}
                onChange={set("unit_price")}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label text-xs">რაოდენობა</label>
              <input
                type="number"
                min="0"
                step="any"
                className="input"
                value={form.quantity}
                onChange={set("quantity")}
              />
            </div>
            <div>
              <label className="label text-xs">სულ (₾)</label>
              <div className="input bg-slate-100 font-semibold tabular-nums">{total.toFixed(2)}</div>
            </div>
          </div>
          {expense ? (
            <p className="text-xs text-slate-500">გადახდები იმართება კომპანიის გადახდების ისტორიიდან.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">გადახდილი ახლა (₾)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={form.paid}
                  onChange={set("paid")}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label text-xs">გადახდის თარიღი</label>
                <DateInput
                  required={paidNow > 0}
                  value={form.paid_date}
                  onChange={(paid_date) => setForm({ ...form, paid_date })}
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="label">შენიშვნები</label>
          <textarea rows={2} className="input" value={form.notes} onChange={set("notes")} />
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              draft.clear();
              onClose();
            }}
          >
            გაუქმება
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "ინახება..." : "შენახვა"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
