"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateShort, formatPrice, todayISO } from "@/lib/format";
import { useDraft } from "@/lib/useDraft";
import {
  buildQuoteHtml,
  computeQuote,
  emptyRow,
  rowPaid,
  rowTotal,
  type Quote,
  type QuoteLabels,
  type Row,
} from "@/lib/quote";
import { printHtml } from "@/lib/print";
import Modal from "./Modal";
import ErrorText from "./ErrorText";

type SavedCalc = {
  id: string;
  patient_name: string | null;
  discount: number;
  rows: Row[];
  total: number;
  updated_at: string;
};

const blank = () => ({
  savedId: "",
  patient: "",
  discount: "",
  rows: [emptyRow()],
});

/** The same calculator serves clinic estimates and lab orders; each keeps its own table and history. */
const KINDS = {
  calc: {
    table: "calculations",
    sql: "supabase/add_calculations.sql",
    draftKey: "calculator",
    title: "🧮 კალკულაცია",
    savedTitle: "📂 შენახული კალკულაციები",
    backLabel: "← კალკულაცია",
    newLabel: "ახალი კალკულაცია",
    emptySaved: "შენახული კალკულაციები ჯერ არ არის",
    itemPlaceholder: "მკურნალობა",
    rowPatient: false,
    print: undefined as QuoteLabels | undefined,
  },
  lab: {
    table: "lab_calculations",
    sql: "supabase/add_lab_calculations.sql",
    draftKey: "lab-calculator",
    title: "🧪 ლაბორატორიებისთვის",
    savedTitle: "📂 ლაბორატორიის ისტორია",
    backLabel: "← ლაბორატორია",
    newLabel: "ახალი ჩანაწერი",
    emptySaved: "შენახული ჩანაწერები ჯერ არ არის",
    itemPlaceholder: "სამუშაო",
    rowPatient: true,
    print: {
      title: "ლაბორატორიული სამუშაოების ხარჯთაღრიცხვა",
      itemHeader: "სამუშაო / მომსახურება",
      note: null,
      patientColumn: true,
      dateColumn: true,
      discountColumn: true,
      paidColumn: true,
      noSignatures: true,
    } as QuoteLabels | undefined,
  },
};
export type CalcKind = keyof typeof KINDS;

/** Price calculator (treatments × quantity × price, minus a % discount) with saving and printing. */
export default function CalculatorModal({ onClose, kind = "calc" }: { onClose: () => void; kind?: CalcKind }) {
  const k = KINDS[kind];
  const draft = useDraft(k.draftKey, blank());
  const { value, setValue } = draft;
  const [view, setView] = useState<"edit" | "saved">("edit");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [patientNames, setPatientNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedJson, setSavedJson] = useState<string | null>(null);

  // Names of treatments done before and of patients, offered as suggestions.
  useEffect(() => {
    supabase
      .from("treatments")
      .select("procedure")
      .limit(1000)
      .then(({ data }) => setSuggestions([...new Set((data ?? []).map((t) => t.procedure.trim()))].sort()));
    supabase
      .from("patients")
      .select("first_name, last_name")
      .order("last_name")
      .limit(2000)
      .then(({ data }) => setPatientNames((data ?? []).map((p) => `${p.first_name} ${p.last_name}`)));
  }, []);

  const setRow = (i: number, patch: Partial<Row>) =>
    setValue({
      ...value,
      rows: value.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    });
  const newRow = (): Row => (k.rowPatient ? { ...emptyRow(), date: todayISO() } : emptyRow());
  const addRow = () => setValue({ ...value, rows: [...value.rows, newRow()] });
  const removeRow = (i: number) =>
    setValue({
      ...value,
      rows: value.rows.length > 1 ? value.rows.filter((_, j) => j !== i) : [newRow()],
    });

  const quote = computeQuote(value.patient, value.discount, value.rows);
  const isSaved = !!value.savedId && savedJson === JSON.stringify(value);

  async function save() {
    setBusy(true);
    setError(null);
    const payload = {
      // Lab orders keep the patient on each row; the list of names makes history searchable.
      patient_name: (k.rowPatient ? rowPatients(quote.rows) : quote.patient) || null,
      discount: quote.percent,
      rows: quote.rows,
      total: quote.total,
      updated_at: new Date().toISOString(),
    };
    const res = value.savedId
      ? await supabase.from(k.table).update(payload).eq("id", value.savedId).select("id").single()
      : await supabase.from(k.table).insert(payload).select("id").single();
    setBusy(false);
    if (res.error) return setError(res.error.message);
    const next = { ...value, savedId: res.data.id };
    setValue(next);
    setSavedJson(JSON.stringify(next));
  }

  function open(c: SavedCalc) {
    const next = {
      savedId: c.id,
      patient: c.patient_name ?? "",
      discount: c.discount ? String(c.discount) : "",
      rows: c.rows.length ? c.rows : [emptyRow()],
    };
    setValue(next);
    setSavedJson(JSON.stringify(next));
    setError(null);
    setView("edit");
  }

  function startNew() {
    draft.reset();
    setSavedJson(null);
    setError(null);
  }

  if (view === "saved") {
    return (
      <Modal title={k.savedTitle} onClose={onClose} wide>
        <SavedList
          kind={kind}
          currentId={value.savedId}
          onOpen={open}
          onBack={() => setView("edit")}
          onDeleted={(id) => {
            if (id === value.savedId) {
              setValue({ ...value, savedId: "" });
              setSavedJson(null);
            }
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal title={k.title} onClose={onClose} wide={k.rowPatient ? "xl" : true}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary py-1.5" onClick={() => setView("saved")}>
            📂 შენახული
          </button>
          <button type="button" className="btn-secondary py-1.5" onClick={startNew}>
            + ახალი
          </button>
          <span className={`ml-auto text-sm ${isSaved ? "text-emerald-700" : "text-slate-400"}`}>
            {isSaved ? "✓ შენახულია" : value.savedId ? "● შეუნახავი ცვლილებები" : k.newLabel}
          </span>
        </div>

        <datalist id="calc-patients">
          {patientNames.map((n, i) => (
            <option key={i} value={n} />
          ))}
        </datalist>
        {!k.rowPatient && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="min-w-48 flex-1">
              <label className="label">პაციენტის სახელი, გვარი</label>
              <input
                className="input"
                list="calc-patients"
                placeholder="სახელი, გვარი"
                value={value.patient}
                onChange={(e) => setValue({ ...value, patient: e.target.value })}
              />
            </div>
            <div>
              <label className="label">ფასდაკლება</label>
              <div className="relative w-32">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  className="input pr-8 tabular-nums"
                  placeholder="0"
                  value={value.discount}
                  onChange={(e) => setValue({ ...value, discount: e.target.value })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                  %
                </span>
              </div>
            </div>
          </div>
        )}

        <datalist id="calc-treatments">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div>
          {k.rowPatient ? (
            <div className="space-y-3">
              {value.rows.map((r, i) => (
                <LabRow
                  key={i}
                  index={i}
                  row={r}
                  itemPlaceholder={k.itemPlaceholder}
                  onChange={(patch) => setRow(i, patch)}
                  onRemove={() => removeRow(i)}
                  onEnter={i === value.rows.length - 1 ? addRow : undefined}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[1fr_80px_100px_100px_32px] gap-2 px-1 pb-1 text-xs font-medium text-slate-500 sm:grid">
                <span>დასახელება</span>
                <span>რაოდენობა</span>
                <span>ფასი (₾)</span>
                <span className="text-right">ჯამი</span>
                <span />
              </div>
              <div className="space-y-2">
                {value.rows.map((r, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[1fr_80px_100px_100px_32px] sm:border-0 sm:p-0"
                  >
                    <input
                      className="input col-span-4 sm:col-span-1"
                      list="calc-treatments"
                      placeholder={k.itemPlaceholder}
                      value={r.name}
                      onChange={(e) => setRow(i, { name: e.target.value })}
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="input tabular-nums"
                      placeholder="1"
                      title="ცარიელი = 1"
                      value={r.qty}
                      onChange={(e) => setRow(i, { qty: e.target.value })}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input tabular-nums"
                      placeholder="0.00"
                      value={r.price}
                      onChange={(e) => setRow(i, { price: e.target.value })}
                      onKeyDown={(e) => {
                        // Enter in the last price field adds a new row.
                        if (e.key === "Enter" && i === value.rows.length - 1) {
                          e.preventDefault();
                          addRow();
                        }
                      }}
                    />
                    <div className="flex items-center justify-end rounded-lg bg-slate-50 px-2 text-sm font-semibold tabular-nums">
                      {rowTotal(r).toFixed(2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="წაშლა"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <button type="button" className="btn-secondary mt-3" onClick={addRow}>
            + რიგის დამატება
          </button>
        </div>

        <div className="ml-auto max-w-xs space-y-1.5 rounded-lg border border-slate-200 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">ჯამი</span>
            <span className="tabular-nums">{formatPrice(quote.subtotal)}</span>
          </div>
          {quote.discountAmount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>ფასდაკლება{quote.percent > 0 && ` (${quote.percent}%)`}</span>
              <span className="tabular-nums">−{formatPrice(quote.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold">
            <span>გადასახდელი</span>
            <span className="tabular-nums text-teal-700">{formatPrice(quote.total)}</span>
          </div>
          {k.rowPatient && (
            <>
              <div className="flex justify-between text-emerald-700">
                <span>გადახდილი</span>
                <span className="tabular-nums">{formatPrice(quote.paid)}</span>
              </div>
              <div
                className={`flex justify-between font-semibold ${quote.remaining > 0 ? "text-red-600" : "text-slate-400"}`}
              >
                <span>დარჩენილი</span>
                <span className="tabular-nums">{formatPrice(quote.remaining)}</span>
              </div>
            </>
          )}
        </div>

        <ErrorText error={error && error.includes(k.table) ? `${error} — გაუშვით ${k.sql} Supabase-ში.` : error} />

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary mr-auto" onClick={onClose}>
            დახურვა
          </button>
          <button type="button" className="btn-secondary text-red-600" onClick={startNew}>
            გასუფთავება
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || quote.rows.length === 0 || isSaved}
            onClick={save}
          >
            {busy ? "ინახება..." : "💾 შენახვა"}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={quote.rows.length === 0}
            onClick={() => printQuote(quote, k.print)}
          >
            🖨 ბეჭდვა
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SavedList({
  kind,
  currentId,
  onOpen,
  onBack,
  onDeleted,
}: {
  kind: CalcKind;
  currentId: string;
  onOpen: (c: SavedCalc) => void;
  onBack: () => void;
  onDeleted: (id: string) => void;
}) {
  const [items, setItems] = useState<SavedCalc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const k = KINDS[kind];

  useEffect(() => {
    supabase
      .from(k.table)
      .select("id, patient_name, discount, rows, total, updated_at")
      .order("updated_at", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) return setError(`${error.message} — გაუშვით ${k.sql} Supabase-ში.`);
        setItems(data ?? []);
      });
  }, [k]);

  async function remove(id: string) {
    const { error } = await supabase.from(k.table).delete().eq("id", id);
    setConfirmId(null);
    if (error) return setError(error.message);
    setItems((list) => (list ?? []).filter((c) => c.id !== id));
    onDeleted(id);
  }

  const q = search.trim().toLowerCase();
  const visible = (items ?? []).filter(
    (c) =>
      !q ||
      (c.patient_name ?? "").toLowerCase().includes(q) ||
      c.rows.some((r) => (r.patient ?? "").toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary py-1.5" onClick={onBack}>
          {k.backLabel}
        </button>
        <input
          className="input max-w-xs flex-1"
          placeholder="🔍 ძებნა პაციენტით..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ErrorText error={error} />
      {!items && !error && <p className="text-sm text-slate-400">იტვირთება...</p>}
      {items && visible.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">{items.length ? "ვერ მოიძებნა" : k.emptySaved}</p>
      )}
      <div className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {visible.map((c) => (
          <div
            key={c.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${c.id === currentId ? "bg-teal-50" : ""}`}
          >
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(c)}>
              <p className="truncate font-medium">{k.rowPatient ? "პაციენტების სია" : c.patient_name || "უსახელო"}</p>
              <p className="text-xs text-slate-500">
                {formatDateShort(c.updated_at.slice(0, 10))} · {c.rows.length} პოზიცია
                {c.discount > 0 && ` · −${Number(c.discount)}%`}
              </p>
            </button>
            <span className="text-right">
              <span className="block font-semibold tabular-nums text-teal-700">{formatPrice(c.total)}</span>
              {k.rowPatient && <RemainingBadge calc={c} />}
            </span>
            {confirmId === c.id ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-red-600">წაიშალოს?</span>
                <button className="btn-secondary px-2 py-1" onClick={() => setConfirmId(null)}>
                  არა
                </button>
                <button className="btn-danger px-2 py-1" onClick={() => remove(c.id)}>
                  დიახ
                </button>
              </span>
            ) : (
              <span className="flex gap-1">
                <button className="btn-secondary px-2.5 py-1" onClick={() => onOpen(c)}>
                  გახსნა
                </button>
                <button
                  className="btn-secondary px-2.5 py-1"
                  title="ბეჭდვა"
                  onClick={() => printQuote(computeQuote(c.patient_name ?? "", c.discount, c.rows), k.print)}
                >
                  🖨
                </button>
                <button
                  className="rounded-lg px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="წაშლა"
                  onClick={() => setConfirmId(c.id)}
                >
                  🗑
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One lab order line as a card: date, patient and work on top, the money below. */
function LabRow({
  index,
  row: r,
  itemPlaceholder,
  onChange,
  onRemove,
  onEnter,
}: {
  index: number;
  row: Row;
  itemPlaceholder: string;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
  onEnter?: () => void;
}) {
  const total = rowTotal(r);
  const left = Math.round((total - rowPaid(r)) * 100) / 100;
  const status =
    total <= 0
      ? "border-slate-200"
      : left <= 0
        ? "border-emerald-300 bg-emerald-50/40"
        : rowPaid(r) > 0
          ? "border-amber-300 bg-amber-50/40"
          : "border-slate-200";
  const field = "text-[11px] font-medium uppercase tracking-wide text-slate-500";
  const enterAdds = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };
  return (
    <div className={`rounded-xl border p-3 shadow-sm ${status}`}>
      <div className="flex items-start gap-3">
        <span className="mt-6 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
          {index + 1}
        </span>
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[150px_1fr_1fr]">
          <label className="block">
            <span className={field}>📅 თარიღი</span>
            <input
              type="date"
              className="input mt-1"
              value={r.date ?? ""}
              onChange={(e) => onChange({ date: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={field}>პაციენტის სახელი, გვარი</span>
            <input
              className="input mt-1"
              list="calc-patients"
              placeholder="სახელი, გვარი"
              value={r.patient ?? ""}
              onChange={(e) => onChange({ patient: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={field}>დასახელება</span>
            <input
              className="input mt-1"
              list="calc-treatments"
              placeholder={itemPlaceholder}
              value={r.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-6 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          title="წაშლა"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:ml-10 sm:mr-10 sm:grid-cols-5">
        <label className="block">
          <span className={field}>რაოდენობა</span>
          <input
            type="number"
            min="0"
            step="any"
            className="input mt-1 tabular-nums"
            placeholder="1"
            title="ცარიელი = 1"
            value={r.qty}
            onChange={(e) => onChange({ qty: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={field}>ფასი (₾)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input mt-1 tabular-nums"
            placeholder="0.00"
            value={r.price}
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={field}>ფასდაკლება</span>
          <div className="relative mt-1">
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              className="input pr-7 tabular-nums"
              placeholder="0"
              value={r.discount ?? ""}
              onChange={(e) => onChange({ discount: e.target.value })}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
              %
            </span>
          </div>
        </label>
        <label className="block">
          <span className={field}>გადახდილი (₾)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input mt-1 tabular-nums"
            placeholder="0.00"
            value={r.paid ?? ""}
            onChange={(e) => onChange({ paid: e.target.value })}
            onKeyDown={enterAdds}
          />
        </label>
        <div className="col-span-2 sm:col-span-1">
          <span className={field}>ჯამი</span>
          <div className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-right font-semibold tabular-nums">
            {formatPrice(total)}
          </div>
          {total > 0 && (
            <p className={`mt-1 text-right text-xs ${left > 0 ? "text-red-600" : "text-emerald-700"}`}>
              {left > 0 ? `დარჩ. ${formatPrice(left)}` : "✓ გადახდილია"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RemainingBadge({ calc }: { calc: SavedCalc }) {
  const { remaining } = computeQuote("", calc.discount, calc.rows);
  return remaining > 0 ? (
    <span className="block text-xs tabular-nums text-red-600">დარჩ. {formatPrice(remaining)}</span>
  ) : (
    <span className="block text-xs text-emerald-700">✓ გადახდილია</span>
  );
}

/** "ნინო ბერიძე, გიორგი კაპანაძე" — distinct patient names of lab rows. */
function rowPatients(rows: Row[]) {
  return [...new Set(rows.map((r) => r.patient?.trim()).filter(Boolean))].join(", ");
}

/** Prints the estimate through a hidden iframe (no new tab). */
function printQuote(q: Quote, labels?: QuoteLabels) {
  printHtml(buildQuoteHtml(q, labels));
}
