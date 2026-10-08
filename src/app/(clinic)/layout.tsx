"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import SetupNotice from "@/components/SetupNotice";

export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(isSupabaseConfigured);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (checking || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        იტვირთება...
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        email={session.user.email ?? ""}
        open={menuOpen}
        onNavigate={() => setMenuOpen(false)}
        onLogout={() => supabase.auth.signOut()}
      />
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-xl hover:bg-slate-100"
            aria-label="მენიუ"
          >
            ☰
          </button>
          <span className="font-semibold">🦷 LIGHT DENT</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
