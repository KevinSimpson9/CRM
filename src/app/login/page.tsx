"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={signIn} className="card w-full max-w-sm space-y-4">
        <div>
          <div className="text-lg font-semibold">
            AK <span className="text-gold">Capital</span> CRM
          </div>
          <div className="text-sm text-muted">Sign in to continue</div>
        </div>
        <div className="space-y-1">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            className="w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            className="w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
        <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
