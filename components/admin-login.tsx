"use client";

import { useState } from "react";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

type AdminLoginProps = {
  passwordConfigured: boolean;
};

export function AdminLogin({ passwordConfigured }: AdminLoginProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Login failed.");
        return;
      }

      setPassword("");
      router.refresh();
    } catch {
      setError("Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold tracking-[0.24em] text-[var(--muted)] uppercase">
            <LockKeyhole className="size-3.5 text-[var(--accent)]" />
            Admin Access
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
            Unlock Admin Portal
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Enter the admin password to access trainer chat, feedback review, and provider controls.
          </p>

          {!passwordConfigured ? (
            <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-amber-300">
              Set <code>ADMIN_PORTAL_PASSWORD</code> in your Vercel environment variables to enable the lock screen.
            </div>
          ) : null}

          <form className="mt-6 grid gap-3" onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Admin password"
              className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            {error ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting || !passwordConfigured}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <LockKeyhole className="size-4" />
              )}
              {isSubmitting ? "Unlocking..." : "Unlock"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
