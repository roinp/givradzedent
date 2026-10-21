"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateShort, formatPrice, todayISO } from "@/lib/format";
import type { PatientPayment, Treatment } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";

export const PAYMENT_METHODS = ["ნაღდი", "ბარათი", "გადმორიცხვა"];

const round = (n: number) => Math.round(n * 100) / 100;

export default function PatientPaymentForm({
  patientId,
  treatments,
  payment,
  defaultTreatmentId,
  patientRemaining,
  onClose,
  onSaved,
}: {
  patientId: string;
  treatments: Treatment[];
  payment?: PatientPayment | null;
  defaultTreatmentId?: string | null;
  patientRemaining: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  // What is still owed, not counting the payment being edited.
  const remainingFor = (treatmentId: string) => {
    if (!treatmentId) return round(patientRemaining + Number(payment?.amount ?? 0));
    const t = treatments.find((x) => x.id === treatmentId);
    if (!t) return 0;
    const own = payment?.treatment_id === treatmentId ? Number(payment.amount) : 0;
    return round(Number(t.price) - Number(t.paid ?? 0) + own);
  };

  const initialTreatment = payment ? (payment.treatment_id ?? "") : (defaultTreatmentId ?? "");
  const initialRemaining = remainingFor(initialTreatment);
  const [form, setForm] = useState({
    date: payment?.date ?? todayISO(),
    treatment_id: initialTreatment,
    amount: payment ? String(payment.amount) : initialRemaining > 0 ? initialRemaining.toFixed(2) : "",
    method: payment?.method ?? PAYMENT_METHODS[0],
    notes: payment?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = remainingFor(form.treatment_id);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = round(Number(form.amount) || 0);
    if (amount <= 0) return setError("მიუთითეთ თანხა");
    if (form.treatment_id && amount > remaining)
      return setError(`თანხა აღემატება ამ მკურნალობის დარჩენილ თანხას (${formatPrice(remaining)})`);
    setBusy(true);
    setError(null);
    const payload = {
      patient_id: patientId,
      treatment_id: form.treatment_id || null,
      date: form.date,
      amount,
      method: form.method || null,
      notes: form.notes.trim() || null,
    };
    const { error } = payment
      ? await supabase.from("patient_payments").update(payload).eq("id", payment.id)
      : await supabase.from("patient_payments").insert(payload);
    setBusy(false);
    if (error) return setError(error.message);
    onSaved();
  }

  return (
    <Modal title={payment ? "გადახდის რედაქტირება" : "ახალი გადახდა"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">რისთვის</label>
          <select
            className="input"
            value={form.treatment_id}
            onChange={(e) => {
              const left = remainingFor(e.target.value);
              setForm({ ...form, treatment_id: e.target.value, amount: left > 0 ? left.toFixed(2) : "" });
            }}
          >
            <option value="">ზოგადი / წინასწარი გადახდა</option>
            {treatments.map((t) => (
              <option key={t.id} value={t.id}>
                {formatDateShort(t.date)} · {t.procedure}
                {t.tooth_number ? ` (🦷 ${t.tooth_number})` : ""} · დარჩ. {formatPrice(remainingFor(t.id))}
              </option>
            ))}
          </select>
          <p className={`mt-1 text-xs ${remaining > 0 ? "text-red-600" : "text-slate-500"}`}>
            დარჩენილი: {formatPrice(remaining)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
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
          <div>
            <label className="label">გადახდის ფორმა</label>
            <select className="input" value={form.method} onChange={set("method")}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
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
