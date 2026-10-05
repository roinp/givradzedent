"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import SetupNotice from "@/components/SetupNotice";
import ErrorText from "@/components/ErrorText";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError("ელ-ფოსტა ან პაროლი არასწორია");
    else router.replace("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100 p-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4 p-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-3xl">
            🦷
          </div>
          <h1 className="mt-4 text-xl font-semibold">გივრაძე დენტ</h1>
          <p className="text-sm text-slate-500">თანამშრომლების შესვლა</p>
        </div>
        <div>
          <label className="label">ელ-ფოსტა</label>
          <input
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label">პაროლი</label>
          <input
            type="password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <ErrorText error={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "შესვლა..." : "შესვლა"}
        </button>
      </form>
    </div>
  );
}
