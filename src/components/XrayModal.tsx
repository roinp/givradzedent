"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/format";
import type { Treatment } from "@/lib/types";
import Modal from "./Modal";
import ErrorText from "./ErrorText";

const BUCKET = "xrays";
const MAX_MB = 15;

/** View, upload, replace or delete the X-ray image attached to a treatment record. */
export default function XrayModal({
  treatment,
  onClose,
  onChanged,
}: {
  treatment: Treatment;
  onClose: () => void;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(treatment.xray_path);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Private bucket: show the image through a short-lived signed URL.
  useEffect(() => {
    if (!path) return;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setUrl(data.signedUrl);
      });
  }, [path]);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return setError("აირჩიეთ სურათის ფაილი (JPG, PNG...)");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`ფაილი ძალიან დიდია (მაქს. ${MAX_MB} MB)`);
    setBusy(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const newPath = `${treatment.patient_id}/${treatment.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return setError(upErr.message);
    }
    const { error: dbErr } = await supabase.from("treatments").update({ xray_path: newPath }).eq("id", treatment.id);
    if (dbErr) {
      await supabase.storage.from(BUCKET).remove([newPath]);
      setBusy(false);
      return setError(dbErr.message);
    }
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    setUrl(null);
    setPath(newPath);
    setBusy(false);
    onChanged();
  }

  async function remove() {
    if (!path) return;
    setBusy(true);
    const { error } = await supabase.from("treatments").update({ xray_path: null }).eq("id", treatment.id);
    if (!error) await supabase.storage.from(BUCKET).remove([path]);
    setBusy(false);
    setConfirmDelete(false);
    if (error) return setError(error.message);
    setPath(null);
    setUrl(null);
    onChanged();
  }

  return (
    <Modal title={`რენტგენი — ${treatment.procedure}`} onClose={onClose} wide>
      <p className="-mt-2 mb-4 text-sm text-slate-500">
        {formatDate(treatment.date)}
        {treatment.tooth_number ? ` · კბილი ${treatment.tooth_number}` : ""}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />

      {path ? (
        <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" title="სრულ ზომაზე გახსნა">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
              <img src={url} alt="რენტგენი" className="max-h-[65vh] w-auto object-contain" />
            </a>
          ) : (
            <p className="text-sm text-slate-400">იტვირთება...</p>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          className="flex min-h-56 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700"
        >
          <span className="text-4xl">🩻</span>
          <span className="font-medium">{busy ? "იტვირთება..." : "რენტგენის სურათის ატვირთვა"}</span>
          <span className="text-xs">დააჭირეთ ან ჩააგდეთ ფაილი აქ · JPG, PNG · მაქს. {MAX_MB} MB</span>
        </button>
      )}

      <div className="mt-3">
        <ErrorText error={error} />
      </div>

      {path && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {confirmDelete ? (
            <>
              <span className="mr-auto self-center text-sm text-red-600">წაიშალოს სურათი?</span>
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
                არა
              </button>
              <button className="btn-danger" disabled={busy} onClick={remove}>
                დიახ, წაშლა
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary text-red-600" disabled={busy} onClick={() => setConfirmDelete(true)}>
                წაშლა
              </button>
              <button className="btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? "იტვირთება..." : "შეცვლა"}
              </button>
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="btn-primary">
                  ⤢ სრულ ზომაზე
                </a>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
