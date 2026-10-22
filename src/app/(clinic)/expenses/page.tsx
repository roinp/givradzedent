"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateShort, formatPrice } from "@/lib/format";
import type { Expense, ExpensePayment } from "@/lib/types";
import ExpenseForm, { EXPENSE_CATEGORIES } from "@/components/ExpenseForm";
import ExpensePaymentForm from "@/components/ExpensePaymentForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination, { paginate } from "@/components/Pagination";
import PasswordGate from "@/components/PasswordGate";
import CalculatorModal from "@/components/CalculatorModal";
import { printHtml } from "@/lib/print";
import { buildSupplierStatementHtml } from "@/lib/supplierStatement";

const totalOf = (e: Expense) => Number(e.unit_price) * Number(e.quantity);
const supplierKey = (s: string | null) => (s ?? "").trim().toLowerCase();

type Company = {
  key: string;
  name: string | null;
  expenses: Expense[];
  payments: ExpensePayment[];
  total: number;
  paid: number;
  remaining: number;
  lastActivity: string;
};

function groupByCompany(expenses: Expense[], payments: ExpensePayment[]): Company[] {
  const map = new Map<string, Company>();
  const get = (supplier: string | null) => {
    const key = supplierKey(supplier);
    let c = map.get(key);
    if (!c) {
      c = {
        key,
        name: supplier?.trim() || null,
        expenses: [],
        payments: [],
        total: 0,
        paid: 0,
        remaining: 0,
        lastActivity: "",
      };
      map.set(key, c);
    }
    return c;
  };
  for (const e of expenses) {
    const c = get(e.supplier);
    c.expenses.push(e);
    c.total += totalOf(e);
    // Legacy per-purchase "paid" (moved to expense_payments by the migration, normally 0).
    c.paid += Number(e.paid);
    if (e.date > c.lastActivity) c.lastActivity = e.date;
  }
  for (const p of payments) {
    const c = get(p.supplier);
    c.payments.push(p);
    c.paid += Number(p.amount);
    if (p.date > c.lastActivity) c.lastActivity = p.date;
  }
  for (const c of map.values()) c.remaining = c.total - c.paid;
  return [...map.values()].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

/** Row colours by payment status: paid off, partly paid, nothing paid yet. */
const STATUS = {
  paid: {
    label: "გადახდილია",
    row: "bg-emerald-50/50 hover:bg-emerald-50",
    bar: "border-l-emerald-500",
    pill: "bg-emerald-100 text-emerald-800",
  },
  partial: {
    label: "ნაწილობრივ",
    row: "bg-amber-50/50 hover:bg-amber-50",
    bar: "border-l-amber-400",
    pill: "bg-amber-100 text-amber-800",
  },
  unpaid: {
    label: "გადაუხდელი",
    row: "bg-red-50/50 hover:bg-red-50",
    bar: "border-l-red-500",
    pill: "bg-red-100 text-red-700",
  },
};
const statusOf = (c: Company) => STATUS[c.remaining <= 0.005 ? "paid" : c.paid > 0.005 ? "partial" : "unpaid"];

// SHA-256 of the expenses password (the password itself is not stored in code).
const EXPENSES_PASSWORD_HASH = "3230c6c3d1e07097503bd32c96aa71d879831ab6a13f1e322383a76b4ab02911";

export default function ExpensesPage() {
  return (
    <PasswordGate title="ხარჯები" passwordHash={EXPENSES_PASSWORD_HASH}>
      <Expenses />
    </PasswordGate>
  );
}

function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<ExpensePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ expense: Expense | null; supplier?: string | null } | null>(null);
  const [paying, setPaying] = useState<{ company: Company; payment: ExpensePayment | null } | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<ExpensePayment | null>(null);
  const [labOpen, setLabOpen] = useState(false);

  const load = useCallback(async () => {
    const [ex, pay] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("expense_payments")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    setLoadError(ex.error ? ex.error.message : pay.error ? pay.error.message : null);
    setExpenses(ex.data ?? []);
    setPayments(pay.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const companies = groupByCompany(expenses, payments);
  const suppliers = companies.map((c) => c.name).filter((n): n is string => !!n);

  const q = search.trim().toLowerCase();
  const matchesExpense = (e: Expense) => !category || e.category === category;
  const filtered = companies.filter(
    (c) =>
      (!q || (c.name ?? "").toLowerCase().includes(q) || c.expenses.some((e) => e.item.toLowerCase().includes(q))) &&
      (!category || c.expenses.some(matchesExpense)) &&
      (!onlyUnpaid || c.remaining > 0.005),
  );

  const sum = (f: (c: Company) => number) => filtered.reduce((s, c) => s + f(c), 0);
  const total = sum((c) => c.total);
  const paid = sum((c) => c.paid);
  const remaining = total - paid;

  const categories = [...new Set([...EXPENSE_CATEGORIES, ...expenses.map((e) => e.category).filter(Boolean)])];

  const { pageItems, pageCount, currentPage } = paginate(filtered, page);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">ხარჯები</h1>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setLabOpen(true)}>
            🧪 ლაბორატორიებისთვის
          </button>
          <button className="btn-primary" onClick={() => setEditing({ expense: null })}>
            + ახალი შესყიდვა
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="სულ ხარჯი" value={formatPrice(total)} color="text-slate-900" />
        <Stat label="გადარიცხული" value={formatPrice(paid)} color="text-emerald-700" />
        <Stat
          label="დარჩენილი გადასახდელი"
          value={formatPrice(remaining)}
          color={remaining > 0.005 ? "text-red-600" : "text-slate-400"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="🔍 ძებნა კომპანიით ან დასახელებით..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input w-auto"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">ყველა კატეგორია</option>
          {categories.map((c) => (
            <option key={c} value={c!}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-teal-600"
            checked={onlyUnpaid}
            onChange={(e) => {
              setOnlyUnpaid(e.target.checked);
              setPage(1);
            }}
          />
          მხოლოდ დავალიანებით
        </label>
        <div className="ml-auto flex flex-wrap gap-2 text-xs">
          {Object.values(STATUS).map((st) => (
            <span key={st.label} className={`rounded-full px-2 py-0.5 font-medium ${st.pill}`}>
              {st.label}
            </span>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-400">იტვირთება...</p>
        ) : loadError ? (
          <p className="p-8 text-center text-sm text-red-600">
            ხარჯების ცხრილი ვერ ჩაიტვირთა. გაუშვით <code>supabase/add_expenses.sql</code> და{" "}
            <code>supabase/add_expense_payments.sql</code> Supabase-ის SQL Editor-ში.
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-slate-400">
            {companies.length ? "ხარჯი ვერ მოიძებნა" : "ხარჯები ჯერ არ არის დამატებული"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm lg:min-w-0">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">კომპანია</th>
                  <th className="px-3 py-3 text-right font-medium">სულ</th>
                  <th className="px-3 py-3 text-right font-medium">გადარიცხული</th>
                  <th className="px-3 py-3 text-right font-medium">დარჩენილი</th>
                  <th className="px-3 py-3 font-medium">ბოლო გადახდა</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-white">
                {pageItems.map((c) => {
                  const open = expanded === c.key;
                  const st = statusOf(c);
                  const shownExpenses = c.expenses.filter(matchesExpense);
                  const lastPayment = c.payments[0];
                  return (
                    <Fragment key={c.key}>
                      <tr
                        className={`cursor-pointer align-top transition-colors ${st.row}`}
                        onClick={() => setExpanded(open ? null : c.key)}
                      >
                        <td className={`border-l-4 px-3 py-3.5 [overflow-wrap:anywhere] ${st.bar}`}>
                          <p className="text-base font-semibold">
                            <span className="mr-1.5 inline-block w-3 text-slate-400">{open ? "▾" : "▸"}</span>
                            🏢 {c.name ?? <span className="text-slate-400">კომპანიის გარეშე</span>}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 pl-5 text-xs text-slate-500">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${st.pill}`}>{st.label}</span>
                            {c.expenses.length} შესყიდვა · {c.payments.length} გადახდა
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-medium">{formatPrice(c.total)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-emerald-700">
                          {formatPrice(c.paid)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${
                            c.remaining > 0.005 ? "text-red-600" : "text-slate-400"
                          }`}
                        >
                          {formatPrice(c.remaining)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">
                          {lastPayment ? formatDateShort(lastPayment.date) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                          <button
                            className="rounded px-2 py-1 text-xs text-teal-700 hover:bg-teal-50"
                            onClick={() => setPaying({ company: c, payment: null })}
                          >
                            + გადახდა
                          </button>
                          <button
                            className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            onClick={() => setEditing({ expense: null, supplier: c.name })}
                          >
                            + შესყიდვა
                          </button>
                          <button
                            className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            title="ბეჭდვა: შესყიდვები და გადახდები"
                            onClick={() => printHtml(buildSupplierStatementHtml(c))}
                          >
                            <span className="text-base">🖨</span> ბეჭდვა
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr className={st.row.split(" ")[0]}>
                          <td colSpan={6} className={`border-l-4 px-3 pb-4 pt-1 ${st.bar}`}>
                            <div className="grid gap-4 lg:grid-cols-2">
                              <section className="rounded-lg border border-slate-200 bg-white">
                                <h3 className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                                  შესყიდვები
                                </h3>
                                {shownExpenses.length === 0 ? (
                                  <p className="px-3 py-3 text-xs text-slate-400">შესყიდვები არ არის</p>
                                ) : (
                                  <ul className="divide-y divide-slate-100">
                                    {shownExpenses.map((e) => (
                                      <li key={e.id} className="flex items-start gap-3 px-3 py-2">
                                        <span className="whitespace-nowrap pt-0.5 text-xs tabular-nums text-slate-500">
                                          {formatDateShort(e.date)}
                                        </span>
                                        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                                          <p className="font-medium">
                                            {e.item}
                                            {e.category && (
                                              <span className="ml-1.5 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                                                {e.category}
                                              </span>
                                            )}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {formatPrice(e.unit_price)} × {Number(e.quantity)}
                                          </p>
                                          {e.notes && (
                                            <p className="whitespace-pre-wrap text-xs text-slate-400">{e.notes}</p>
                                          )}
                                        </div>
                                        <span className="whitespace-nowrap font-medium">{formatPrice(totalOf(e))}</span>
                                        <RowActions
                                          onEdit={() => setEditing({ expense: e })}
                                          onDelete={() => setDeleting(e)}
                                        />
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </section>
                              <section className="rounded-lg border border-slate-200 bg-white">
                                <h3 className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                                  გადახდების ისტორია
                                </h3>
                                {c.payments.length === 0 ? (
                                  <p className="px-3 py-3 text-xs text-slate-400">გადახდა ჯერ არ ყოფილა</p>
                                ) : (
                                  <ul className="divide-y divide-slate-100">
                                    {c.payments.map((p) => (
                                      <li key={p.id} className="flex items-start gap-3 px-3 py-2">
                                        <span className="whitespace-nowrap pt-0.5 text-xs tabular-nums text-slate-500">
                                          {formatDateShort(p.date)}
                                        </span>
                                        <p className="min-w-0 flex-1 whitespace-pre-wrap text-xs text-slate-500 [overflow-wrap:anywhere]">
                                          {p.notes}
                                        </p>
                                        <span className="whitespace-nowrap font-medium text-emerald-700">
                                          {formatPrice(p.amount)}
                                        </span>
                                        <RowActions
                                          onEdit={() => setPaying({ company: c, payment: p })}
                                          onDelete={() => setDeletingPayment(p)}
                                        />
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </section>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-3 py-3">ჯამი ({filtered.length} კომპანია)</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{formatPrice(total)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-emerald-700">{formatPrice(paid)}</td>
                  <td
                    className={`whitespace-nowrap px-3 py-3 text-right ${remaining > 0.005 ? "text-red-600" : "text-slate-400"}`}
                  >
                    {formatPrice(remaining)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {labOpen && <CalculatorModal kind="lab" onClose={() => setLabOpen(false)} />}
      {editing && (
        <ExpenseForm
          expense={editing.expense}
          defaultSupplier={editing.supplier}
          suppliers={suppliers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {paying && (
        <ExpensePaymentForm
          supplier={paying.company.name}
          payment={paying.payment}
          remaining={paying.company.remaining + (paying.payment ? Number(paying.payment.amount) : 0)}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          message={`წაიშალოს შესყიდვა „${deleting.item}“?`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await supabase.from("expenses").delete().eq("id", deleting.id);
            setDeleting(null);
            load();
          }}
        />
      )}
      {deletingPayment && (
        <ConfirmDialog
          message={`წაიშალოს გადახდა ${formatPrice(deletingPayment.amount)} (${formatDateShort(deletingPayment.date)})?`}
          onClose={() => setDeletingPayment(null)}
          onConfirm={async () => {
            await supabase.from("expense_payments").delete().eq("id", deletingPayment.id);
            setDeletingPayment(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <span className="flex shrink-0">
      <button
        className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        onClick={onEdit}
        title="რედაქტირება"
      >
        ✎
      </button>
      <button
        className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
        onClick={onDelete}
        title="წაშლა"
      >
        🗑
      </button>
    </span>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
