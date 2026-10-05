"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fullName, todayISO } from "@/lib/format";
import { useDoctors } from "@/lib/useDoctors";
import type { Appointment, Patient } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";

type PatientOption = Pick<Patient, "id" | "first_name" | "last_name" | "phone">;

export default function AppointmentForm({
  appointment,
  defaultDate,
  defaultPatientId,
  onClose,
  onSaved,
}: {
  appointment?: Appointment | null;
  defaultDate?: string;
  defaultPatientId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const doctors = useDoctors();
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    patient_id: appointment?.patient_id ?? defaultPatientId ?? "",
    doctor_id: appointment?.doctor_id ?? "",
    date: appointment?.date ?? defaultDate ?? todayISO(),
    time: appointment?.time?.slice(0, 5) ?? "10:00",
    reason: appointment?.reason ?? "",
    notes: appointment?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("patients")
      .select("id, first_name, last_name, phone")
      .order("last_name")
      .then(({ data }) => setPatients(data ?? []));
  }, []);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const q = filter.trim().toLowerCase();
  const visiblePatients = q
    ? patients.filter(
        (p) =>
          p.id === form.patient_id ||
          fullName(p).toLowerCase().includes(q) ||
          (p.phone ?? "").includes(q),
      )
    : patients;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patient_id) return setError("აირჩიეთ პაციენტი");
    setBusy(true);
    setError(null);
    const payload = {
      patient_id: form.patient_id,
      doctor_id: form.doctor_id || null,
      date: form.date,
      time: form.time,
      reason: form.reason.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = appointment
      ? await supabase.from("appointments").update(payload).eq("id", appointment.id)
      : await supabase.from("appointments").insert(payload);
    setBusy(false);
    if (error) return setError(error.message);
    onSaved();
  }

  return (
    <Modal title={appointment ? "ვიზიტის რედაქტირება" : "ვიზიტის დაჯავშნა"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">პაციენტი *</label>
          {!defaultPatientId && (
            <input
              className="input mb-2"
              placeholder="ძებნა სახელით ან ტელეფონით..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          )}
          <select
            required
            className="input"
            value={form.patient_id}
            onChange={set("patient_id")}
            disabled={Boolean(defaultPatientId)}
          >
            <option value="">— აირჩიეთ პაციენტი —</option>
            {visiblePatients.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
                {p.phone ? ` · ${p.phone}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="label">ექიმი</label>
            <select className="input" value={form.doctor_id} onChange={set("doctor_id")}>
              <option value="">— აირჩიეთ —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.specialty ? ` (${d.specialty})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">თარიღი *</label>
            <input type="date" required className="input" value={form.date} onChange={set("date")} />
          </div>
          <div>
            <label className="label">დრო *</label>
            <input type="time" required step={300} className="input" value={form.time} onChange={set("time")} />
          </div>
        </div>
        <div>
          <label className="label">მიზეზი</label>
          <input
            className="input"
            value={form.reason}
            onChange={set("reason")}
            placeholder="მაგ. კონსულტაცია, ტკივილი, წმენდა"
          />
        </div>
        <div>
          <label className="label">შენიშვნები</label>
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
