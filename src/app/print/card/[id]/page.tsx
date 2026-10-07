"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizeCard, type MedicalCardData } from "@/lib/medicalCard";
import type { Patient } from "@/lib/types";
import MedicalCardDocument, { CARD_BASE_CSS, CARD_CSS } from "@/components/MedicalCardDocument";

/** Word page setup: A4 with margins; replaces the browser-only preview styles. */
const WORD_CSS = `
@page WordSection1 { size: 595.3pt 841.9pt; margin: 40pt 40pt 40pt 52pt; }
div.WordSection1 { page: WordSection1; }
${CARD_BASE_CSS}
.mc-page { width: auto; min-height: 0; padding: 0; margin: 0; box-shadow: none; }
`;

type Loaded = { patient: Patient; card: MedicalCardData; cardNumber: number };

/** Standalone A4 view of a patient's medical card (no sidebar) with print and Word export. */
export default function PrintCardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const docRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return router.replace("/login");
      const [p, c] = await Promise.all([
        supabase.from("patients").select("*").eq("id", id).maybeSingle(),
        supabase.from("medical_cards").select("card_number, data").eq("patient_id", id).maybeSingle(),
      ]);
      if (!p.data || !c.data) return setError("სამედიცინო ბარათი ვერ მოიძებნა. ჯერ შეავსეთ და შეინახეთ.");
      setLoaded({ patient: p.data, card: normalizeCard(c.data.data), cardNumber: c.data.card_number });
    })();
  }, [id, router]);

  function downloadWord() {
    if (!loaded || !docRef.current) return;
    const { patient } = loaded;
    const html =
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
      `<head><meta charset="utf-8"><title>სამედიცინო ბარათი</title>` +
      `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->` +
      `<style>${WORD_CSS}</style></head>` +
      `<body><div class="WordSection1">${docRef.current.innerHTML}</div></body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `სამედიცინო ბარათი - ${patient.last_name} ${patient.first_name}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ?print=1 opens the print dialog, ?word=1 downloads the Word file, once the card is shown.
  useEffect(() => {
    if (!loaded) return;
    const params = new URLSearchParams(window.location.search);
    const timer = setTimeout(() => {
      if (params.has("print")) window.print();
      else if (params.has("word")) downloadWord();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (error) return <p className="p-10 text-center text-slate-500">{error}</p>;
  if (!loaded) return <p className="p-10 text-center text-slate-400">იტვირთება...</p>;

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <style>{`${CARD_CSS} @media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
      <div className="no-print sticky top-0 z-10 mb-6 flex flex-wrap items-center justify-center gap-2 border-b border-slate-300 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <span className="mr-auto text-sm font-medium text-slate-700">
          სამედიცინო ბარათი № {loaded.cardNumber} — {loaded.patient.first_name} {loaded.patient.last_name}
        </span>
        <button className="btn-primary" onClick={() => window.print()}>
          🖨 ბეჭდვა
        </button>
        <button className="btn-secondary" onClick={downloadWord}>
          ⬇ Word (.doc)
        </button>
        <button className="btn-secondary" onClick={() => window.close()}>
          ✕ დახურვა
        </button>
      </div>
      <div ref={docRef}>
        <MedicalCardDocument card={loaded.card} patient={loaded.patient} cardNumber={loaded.cardNumber} />
      </div>
    </div>
  );
}
