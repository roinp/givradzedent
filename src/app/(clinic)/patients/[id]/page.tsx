"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { age, formatDate, formatPrice, formatTime, todayISO } from "@/lib/format";
import type { Appointment, Patient, Treatment } from "@/lib/types";
import PatientForm from "@/components/PatientForm";
import TreatmentForm from "@/components/TreatmentForm";
import AppointmentForm from "@/components/AppointmentForm";
import AppointmentDetails from "@/components/AppointmentDetails";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [editingPatient, setEditingPatient] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState<Treatment | null | "new">(null);
  const [deletingTreatment, setDeletingTreatment] = useState<Treatment | null>(null);
  const [booking, setBooking] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  const load = useCallback(async () => {
    const [p, t, a] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("treatments")
        .select("*, doctors(id, name)")
        .eq("patient_id", id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("*, patients(id, first_name, last_name, phone), doctors(id, name)")
        .eq("patient_id", id)
        .gte("date", todayISO())
        .order("date")
        .order("time"),
    ]);
    if (!p.data) setNotFound(true);
    setPatient(p.data);
    setTreatments(t.data ?? []);
    setAppointments(a.data ?? []);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (notFound) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-500">პაციენტი ვერ მოიძებნა.</p>
        <Link href="/patients" className="mt-4 inline-block text-teal-700 hover:underline">
          ← პაციენტების სია
        </Link>
      </div>
    );
  }
  if (!patient) return <p className="text-slate-400">იტვირთება...</p>;

  const total = treatments.reduce((s, t) => s + Number(t.price), 0);
  const paid = treatments.reduce((s, t) => s + Number(t.paid ?? 0), 0);
  const remaining = total - paid;
  const years = age(patient.date_of_birth);

  return (
    <div className="space-y-6">
      <Link href="/patients" className="text-sm text-slate-500 hover:text-slate-800">
        ← პაციენტები
      </Link>

      {/* Patient info */}
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-xl font-semibold text-teal-700">
              {patient.first_name[0]}
              {patient.last_name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">
                {patient.first_name} {patient.last_name}
              </h1>
              <p className="text-sm text-slate-500">
                {patient.phone ?? "ტელეფონი არ არის"}
                {years !== null && ` · ${years} წლის`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setBooking(true)}>
              + ვიზიტის დაჯავშნა
            </button>
            <button className="btn-secondary" onClick={() => setEditingPatient(true)}>
              რედაქტირება
            </button>
            <button className="btn-secondary text-red-600" onClick={() => setDeletingPatient(true)}>
              წაშლა
            </button>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="სახელი" value={patient.first_name} />
          <Info label="გვარი" value={patient.last_name} />
          <Info label="ტელეფონი" value={patient.phone ?? "—"} />
          <Info label="დაბადების თარიღი" value={formatDate(patient.date_of_birth)} />
          <div className="sm:col-span-2 lg:col-span-4">
            <Info label="შენიშვნები" value={patient.notes ?? "—"} />
          </div>
        </dl>
      </section>

      {/* Upcoming appointments */}
      {appointments.length > 0 && (
        <section className="card">
          <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">მომავალი ვიზიტები</h2>
          <div className="divide-y divide-slate-100">
            {appointments.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAppt(a)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-semibold text-teal-700">
                  {formatDate(a.date)}, {formatTime(a.time)}
                </span>
                <span>{a.reason ?? "—"}</span>
                <span className="text-slate-500">{a.doctors?.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Treatment history */}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold">მკურნალობის ისტორია</h2>
            <p className="text-xs text-slate-500">
              {treatments.length} ჩანაწერი · სულ {formatPrice(total)} · გადახდილი {formatPrice(paid)} ·{" "}
              <span className={remaining > 0 ? "font-semibold text-red-600" : "text-emerald-700"}>
                დარჩენილი {formatPrice(remaining)}
              </span>
            </p>
          </div>
          <button className="btn-primary" onClick={() => setTreatmentForm("new")}>
            + მკურნალობის დამატება
          </button>
        </div>

        {treatments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">მკურნალობის ჩანაწერები არ არის</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">თარიღი</th>
                  <th className="px-5 py-3 font-medium">ექიმი</th>
                  <th className="px-5 py-3 font-medium">მკურნალობა</th>
                  <th className="px-5 py-3 font-medium">კბილი</th>
                  <th className="px-5 py-3 font-medium">შენიშვნა</th>
                  <th className="px-5 py-3 text-right font-medium">სულ გადასახდელი</th>
                  <th className="px-5 py-3 text-right font-medium">გადახდილი</th>
                  <th className="px-5 py-3 text-right font-medium">დარჩენილი</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {treatments.map((t) => (
                  <tr key={t.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3">{formatDate(t.date)}</td>
                    <td className="px-5 py-3 text-slate-600">{t.doctors?.name ?? "—"}</td>
                    <td className="min-w-32 max-w-56 px-5 py-3 font-medium [overflow-wrap:anywhere]">{t.procedure}</td>
                    <td className="px-5 py-3">
                      {t.tooth_number ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5">{t.tooth_number}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="w-64 min-w-48 max-w-xs whitespace-pre-wrap px-5 py-3 text-slate-600 [overflow-wrap:anywhere]">
                      {t.notes ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-medium">{formatPrice(t.price)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-emerald-700">{formatPrice(t.paid)}</td>
                    <td
                      className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${
                        Number(t.price) - Number(t.paid ?? 0) > 0 ? "text-red-600" : "text-slate-400"
                      }`}
                    >
                      {formatPrice(Number(t.price) - Number(t.paid ?? 0))}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <button
                        className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        onClick={() => setTreatmentForm(t)}
                        title="რედაქტირება"
                      >
                        ✎
                      </button>
                      <button
                        className="rounded px-2 py-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeletingTreatment(t)}
                        title="წაშლა"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-5 py-3" colSpan={5}>
                    ჯამი
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">{formatPrice(total)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-emerald-700">{formatPrice(paid)}</td>
                  <td
                    className={`whitespace-nowrap px-5 py-3 text-right ${
                      remaining > 0 ? "text-red-600" : "text-slate-400"
                    }`}
                  >
                    {formatPrice(remaining)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {editingPatient && (
        <PatientForm
          patient={patient}
          onClose={() => setEditingPatient(false)}
          onSaved={(p) => {
            setPatient(p);
            setEditingPatient(false);
          }}
        />
      )}
      {deletingPatient && (
        <ConfirmDialog
          message="ნამდვილად გსურთ პაციენტის წაშლა? წაიშლება მისი ვიზიტები და მკურნალობის ისტორიაც."
          onClose={() => setDeletingPatient(false)}
          onConfirm={async () => {
            await supabase.from("patients").delete().eq("id", patient.id);
            router.replace("/patients");
          }}
        />
      )}
      {treatmentForm && (
        <TreatmentForm
          patientId={patient.id}
          treatment={treatmentForm === "new" ? null : treatmentForm}
          onClose={() => setTreatmentForm(null)}
          onSaved={() => {
            setTreatmentForm(null);
            load();
          }}
        />
      )}
      {deletingTreatment && (
        <ConfirmDialog
          message={`წაიშალოს ჩანაწერი „${deletingTreatment.procedure}"?`}
          onClose={() => setDeletingTreatment(null)}
          onConfirm={async () => {
            await supabase.from("treatments").delete().eq("id", deletingTreatment.id);
            setDeletingTreatment(null);
            load();
          }}
        />
      )}
      {booking && (
        <AppointmentForm
          defaultPatientId={patient.id}
          onClose={() => setBooking(false)}
          onSaved={() => {
            setBooking(false);
            load();
          }}
        />
      )}
      {selectedAppt && (
        <AppointmentDetails appointment={selectedAppt} onClose={() => setSelectedAppt(null)} onChanged={load} />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
