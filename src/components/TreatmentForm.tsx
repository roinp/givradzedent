"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayISO } from "@/lib/format";
import { useDoctors } from "@/lib/useDoctors";
import { useDraft } from "@/lib/useDraft";
import type { Treatment } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";
import DateInput from "./DateInput";
import DraftNotice from "./DraftNotice";
import { PAYMENT_METHODS } from "./PatientPaymentForm";

export default function TreatmentForm({
  patientId,
  treatment,
  onClose,
  onSaved,
}: {
  patientId: string;
  treatment?: Treatment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const doctors = useDoctors();
  const draft = useDraft(treatment ? `treatment:${treatment.id}` : `treatment:new:${patientId}`, {
    date: treatment?.date ?? todayISO(),
    doctor_id: treatment?.doctor_id ?? "",
    procedure: treatment?.procedure ?? "",
    tooth_number: treatment?.tooth_number ?? "",
    notes: treatment?.notes ?? "",
    price: treatment ? String(treatment.price) : "",
    paid: "",
    paid_date: todayISO(),
    method: PAYMENT_METHODS[0],
  });
  const { value: form, setValue: setForm } = draft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // For an existing treatment "paid" comes from its payment history; for a new one it's the payment made now.
  const paid = treatment ? Number(treatment.paid ?? 0) : Number(form.paid) || 0;
  const remaining = Math.round(((Number(form.price) || 0) - paid) * 100) / 100;

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (remaining < 0)
      return setError(
        treatment
          ? "ფასი ნაკლებია უკვე გადახდილ თანხაზე — ჯერ შეცვალეთ გადახდების ისტორია"
          : "გადახდილი თანხა აღემატება სულ გადასახდელს",
      );
    setBusy(true);
    setError(null);
    const payload = {
      patient_id: patientId,
      date: form.date,
      doctor_id: form.doctor_id || null,
      procedure: form.procedure.trim(),
      tooth_number: form.tooth_number.trim() || null,
      notes: form.notes.trim() || null,
      price: Number(form.price) || 0,
    };
    const { data, error } = treatment
      ? await supabase.from("treatments").update(payload).eq("id", treatment.id).select("id").single()
      : await supabase.from("treatments").insert(payload).select("id").single();
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    if (!treatment && paid > 0) {
      const res = await supabase.from("patient_payments").insert({
        patient_id: patientId,
        treatment_id: data.id,
        date: form.paid_date,
        amount: paid,
        method: form.method,
      });
      if (res.error) {
        setBusy(false);
        return setError(`მკურნალობა შეინახა, მაგრამ გადახდა ვერა: ${res.error.message}`);
      }
    }
    setBusy(false);
    draft.clear();
    onSaved();
  }

  return (
    <Modal title={treatment ? "მკურნალობის რედაქტირება" : "მკურნალობის დამატება"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <DraftNotice restored={draft.restored} onReset={draft.reset} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">თარიღი *</label>
            <DateInput required value={form.date} onChange={(date) => setForm({ ...form, date })} />
          </div>
          <div>
            <label className="label">ექიმი</label>
            <select className="input" value={form.doctor_id} onChange={set("doctor_id")}>
              <option value="">— აირჩიეთ —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">მკურნალობა / პროცედურა *</label>
            <input
              required
              className="input"
              value={form.procedure}
              onChange={set("procedure")}
              placeholder="მაგ. ბჟენი, არხის მკურნალობა, ექსტრაქცია"
            />
          </div>
          <div>
            <label className="label">კბილის ნომერი</label>
            <input className="input" value={form.tooth_number} onChange={set("tooth_number")} placeholder="მაგ. 36" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div>
            <label className="label text-xs">სულ გადასახდელი</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.price}
              onChange={set("price")}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="label text-xs">{treatment ? "გადახდილი" : "გადახდილი ახლა"}</label>
            {treatment ? (
              <div className="input bg-slate-100 tabular-nums">{paid.toFixed(2)}</div>
            ) : (
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.paid}
                onChange={set("paid")}
                placeholder="0.00"
              />
            )}
          </div>
          <div>
            <label className="label text-xs">დარჩენილი</label>
            <div
              className={`input font-semibold tabular-nums ${
                remaining > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {remaining.toFixed(2)}
            </div>
          </div>
          {treatment ? (
            <p className="col-span-3 text-xs text-slate-500">გადახდები იმართება პაციენტის გადახდების ისტორიიდან.</p>
          ) : (
            Number(form.paid) > 0 && (
              <>
                <div>
                  <label className="label text-xs">გადახდის თარიღი</label>
                  <DateInput required value={form.paid_date} onChange={(paid_date) => setForm({ ...form, paid_date })} />
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">გადახდის ფორმა</label>
                  <select className="input" value={form.method} onChange={set("method")}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )
          )}
        </div>
        <div>
          <label className="label">შენიშვნები</label>
          <textarea rows={3} className="input" value={form.notes} onChange={set("notes")} />
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => { draft.clear(); onClose(); }}>
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
