"use client";

import { useRef, useState } from "react";

/** "2026-10-23" → "23.10.2026" */
const toDisplay = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : "";
};

/** "23.10.2026", "23/10/2026", "23-10-2026" → "2026-10-23", or null if not a real date. */
const parseDisplay = (text: string) => {
  const m = text.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/**
 * Date field that always shows day.month.year (the native date input follows the
 * browser's locale), with a 📅 button that opens the browser's calendar picker.
 * `value` and `onChange` use YYYY-MM-DD, like `<input type="date">`.
 */
export default function DateInput({
  value,
  onChange,
  className = "",
  required = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  required?: boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  // While typing, keep the raw text; otherwise show the formatted value.
  const [typing, setTyping] = useState<string | null>(null);

  function commit(text: string) {
    setTyping(null);
    if (!text.trim()) return onChange("");
    const iso = parseDisplay(text);
    if (iso) onChange(iso);
  }

  return (
    <div className={`relative ${className}`}>
      <input
        className="input pr-9 tabular-nums"
        placeholder="დდ.თთ.წწწწ"
        required={required}
        inputMode="numeric"
        value={typing ?? toDisplay(value)}
        onChange={(e) => setTyping(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        }}
      />
      <button
        type="button"
        title="კალენდარი"
        className="absolute inset-y-0 right-1 my-1 rounded-md px-1.5 text-slate-500 hover:bg-slate-100"
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
            el.click();
          }
        }}
      >
        📅
      </button>
      {/* Hidden native input, used only for its calendar popup. */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        value={value}
        onChange={(e) => {
          setTyping(null);
          onChange(e.target.value);
        }}
      />
    </div>
  );
}
