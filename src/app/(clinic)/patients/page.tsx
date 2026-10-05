"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/format";
import type { Patient } from "@/lib/types";
import PatientForm from "@/components/PatientForm";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Patient | null | "new">(null);
  const [deleting, setDeleting] = useState<Patient | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("patients").select("*").order("last_name").order("first_name");
    setPatients(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? patients.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          `${p.last_name} ${p.first_name}`.toLowerCase().includes(q) ||
          (p.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, "")),
      )
    : patients;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">პაციენტები</h1>
        <button className="btn-primary" onClick={() => setEditing("new")}>
          + ახალი პაციენტი
        </button>
      </div>

      <input
        className="input max-w-md"
        placeholder="🔍 ძებნა სახელით ან ტელეფონით..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-400">იტვირთება...</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-slate-400">
            {q ? "პაციენტი ვერ მოიძებნა" : "პაციენტები ჯერ არ არის დამატებული"}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">სახელი, გვარი</th>
                <th className="px-5 py-3 font-medium">ტელეფონი</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">დაბადების თარიღი</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/patients/${p.id}`} className="font-medium text-teal-700 hover:underline">
                      {p.first_name} {p.last_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{p.phone ?? "—"}</td>
                  <td className="hidden px-5 py-3 text-slate-600 md:table-cell">{formatDate(p.date_of_birth)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <button
                      className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      onClick={() => setEditing(p)}
                      title="რედაქტირება"
                    >
                      ✎
                    </button>
                    <button
                      className="rounded px-2 py-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => setDeleting(p)}
                      title="წაშლა"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-sm text-slate-400">სულ: {filtered.length}</p>

      {editing && (
        <PatientForm
          patient={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={`წაიშალოს პაციენტი „${deleting.first_name} ${deleting.last_name}"? წაიშლება მისი ვიზიტები და მკურნალობის ისტორიაც.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await supabase.from("patients").delete().eq("id", deleting.id);
            setDeleting(null);
            load();
          }}
        />
      )}
    </div>
  );
}
