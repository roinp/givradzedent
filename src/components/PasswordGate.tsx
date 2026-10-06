"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import ErrorText from "./ErrorText";

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Asks for a password before showing `children`. Only the SHA-256 hash of the
 * password lives in the code. This is a UI lock for a shared computer, not
 * database security: logged-in staff can still reach the data through the API.
 */
export default function PasswordGate({
  passwordHash,
  title,
  children,
}: {
  passwordHash: string;
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (unlocked) return <>{children}</>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = (await sha256(password)) === passwordHash;
    setBusy(false);
    if (ok) setUnlocked(true);
    else {
      setError("პაროლი არასწორია");
      setPassword("");
    }
  }

  return (
    <Modal title={title} onClose={() => router.push("/")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">🔒</div>
          <p className="mt-3 text-sm text-slate-600">ამ გვერდის სანახავად შეიყვანეთ პაროლი</p>
        </div>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            autoFocus
            required
            className="input pr-12"
            placeholder="პაროლი"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-700"
            title={show ? "დამალვა" : "ჩვენება"}
          >
            {show ? "🙈" : "👁"}
          </button>
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => router.push("/")}>
            გაუქმება
          </button>
          <button className="btn-primary" disabled={busy || !password}>
            შესვლა
          </button>
        </div>
      </form>
    </Modal>
  );
}
