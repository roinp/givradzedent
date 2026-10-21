"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatPrice, todayISO } from "@/lib/format";
import type { ExpensePayment } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";

export default function ExpensePaymentForm({
  supplier,
  payment,
  remaining,
  onClose,
  onSaved,
}: {
  supplier: string | null;
  payment?: ExpensePayment | null;
  remaining: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    date: payment?.date ?? todayISO(),
    amount: payment ? String(payment.amount) : remaining > 0 ? remaining.toFixed(2) : "",
    notes: payment?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount) || 0;
    if (amount <= 0) return setError("მიუთითეთ თანხა");
    setBusy(true);
    setError(null);
    const payload = { supplier, date: form.date, amount, notes: form.notes.trim() || null };
    const { error } = payment
      ? await supabase.from("expense_payments").update(payload).eq("id", payment.id)
      : await supabase.from("expense_payments").insert(payload);
    setBusy(false);
    if (error) return setError(error.message);
    onSaved();
  }

  return (
    <Modal title={payment ? "გადახდის რედაქტირება" : "ახალი გადახდა"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          🏢 <span className="font-medium">{supplier ?? "კომპანიის გარეშე"}</span>
          <span className="ml-2 text-slate-400">დარჩენილი: {formatPrice(remaining)}</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">გადახდის თარიღი *</label>
            <input type="date" required className="input" value={form.date} onChange={set("date")} />
          </div>
          <div>
            <label className="label">თანხა (₾) *</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              className="input"
              value={form.amount}
              onChange={set("amount")}
            />
          </div>
        </div>
        <div>
          <label className="label">შენიშვნა</label>
          <textarea rows={2} className="input" value={form.notes} onChange={set("notes")} />
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
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
