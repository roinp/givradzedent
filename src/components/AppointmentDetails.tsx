"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatDate, formatTime, fullName } from "@/lib/format";
import type { Appointment } from "@/lib/types";
import Modal from "./Modal";
import AppointmentForm from "./AppointmentForm";
import ConfirmDialog from "./ConfirmDialog";

/** Details modal for an appointment, with edit and cancel actions. */
export default function AppointmentDetails({
  appointment,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "cancel">("view");

  if (mode === "edit") {
    return (
      <AppointmentForm
        appointment={appointment}
        onClose={() => setMode("view")}
        onSaved={() => {
          onChanged();
          onClose();
        }}
      />
    );
  }

  if (mode === "cancel") {
    return (
      <ConfirmDialog
        message="ნამდვილად გსურთ ამ ვიზიტის გაუქმება? პაციენტს გაეგზავნება SMS."
        confirmLabel="ვიზიტის გაუქმება"
        busyLabel="უქმდება..."
        cancelLabel="უკან"
        onClose={() => setMode("view")}
        onConfirm={async () => {
          const error = await cancelVisit(appointment.id);
          if (error) window.alert(error);
          onChanged();
          onClose();
        }}
      />
    );
  }

  const rows: [string, React.ReactNode][] = [
    [
      "პაციენტი",
      <Link
        key="p"
        href={`/patients/${appointment.patient_id}`}
        className="font-medium text-teal-700 hover:underline"
      >
        {fullName(appointment.patients)}
      </Link>,
    ],
    ["ტელეფონი", appointment.patients?.phone ?? "—"],
    ["ექიმი", appointment.doctors?.name ?? "—"],
    ["თარიღი", formatDate(appointment.date)],
    ["დრო", formatTime(appointment.time)],
    ["მიზეზი", appointment.reason ?? "—"],
    ["შენიშვნები", appointment.notes ?? "—"],
  ];

  return (
    <Modal title="ვიზიტის დეტალები" onClose={onClose}>
      <dl className="divide-y divide-slate-100">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-2 py-2.5 text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="col-span-2 whitespace-pre-wrap">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button className="btn-secondary text-red-600" onClick={() => setMode("cancel")}>
          ვიზიტის გაუქმება
        </button>
        <button className="btn-primary" onClick={() => setMode("edit")}>
          რედაქტირება
        </button>
      </div>
    </Modal>
  );
}

/** Deletes the visit on the server, which texts the patient 5 seconds later. Returns a message to show, if any. */
async function cancelVisit(appointmentId: string) {
  const { data } = await supabase.auth.getSession();
  try {
    const res = await fetch("/api/sms/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ appointmentId }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return `ვიზიტი ვერ გაუქმდა: ${body?.error ?? `შეცდომა ${res.status}`}`;
    return body?.warning ? `ვიზიტი გაუქმდა. ${body.warning}` : null;
  } catch {
    return "სერვერთან კავშირი ვერ დამყარდა";
  }
}
