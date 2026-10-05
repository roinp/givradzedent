"use client";

import { TIME_SLOTS } from "@/lib/format";

/**
 * Compact grid of 30-minute time slots, shown inline below its trigger.
 * Free slots are green; slots in `busy` (time → who booked it) are red and disabled.
 */
export default function TimeSlotPicker({
  value,
  busy,
  onChange,
}: {
  value: string;
  busy: Record<string, string>;
  onChange: (time: string) => void;
}) {
  const slots = TIME_SLOTS.includes(value) || !value ? TIME_SLOTS : [...TIME_SLOTS, value].sort();
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {slots.map((t) => {
          const takenBy = busy[t];
          const selected = t === value;
          return (
            <button
              key={t}
              type="button"
              disabled={Boolean(takenBy)}
              title={takenBy ? `დაკავებულია: ${takenBy}` : "თავისუფალია"}
              onClick={() => onChange(t)}
              className={`rounded-md py-1.5 text-xs font-medium tabular-nums transition ${
                takenBy
                  ? "cursor-not-allowed bg-red-50 text-red-500 line-through ring-1 ring-red-200"
                  : selected
                    ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600"
                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-4 px-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200 ring-1 ring-emerald-300" /> თავისუფალი
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-100 ring-1 ring-red-300" /> დაკავებული
        </span>
      </div>
    </div>
  );
}
