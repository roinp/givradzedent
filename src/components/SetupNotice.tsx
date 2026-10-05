export default function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-lg p-8">
        <h1 className="text-xl font-semibold">🦷 Supabase არ არის დაკავშირებული</h1>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            შექმენით პროექტი <b>supabase.com</b>-ზე.
          </li>
          <li>
            SQL Editor-ში გაუშვით{" "}
            <code className="rounded bg-slate-100 px-1">supabase/schema.sql</code>.
          </li>
          <li>
            Project Settings → API-დან დააკოპირეთ URL და anon key ფაილში{" "}
            <code className="rounded bg-slate-100 px-1">.env.local</code>.
          </li>
          <li>
            გადატვირთეთ სერვერი (<code className="rounded bg-slate-100 px-1">npm run dev</code>).
          </li>
        </ol>
      </div>
    </div>
  );
}
