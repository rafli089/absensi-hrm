"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("password", password);
      const res = await fetch("/api/auth/login", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Login gagal.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-sm space-y-6 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-lg">
          <LogIn className="size-7" aria-hidden />
        </div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Absensi & HR</h1>
        <p className="text-[13px] text-[var(--ink-2)]">Masuk untuk mengelola absensi karyawan</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-[var(--ink)]">Email</span>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-2)]/60 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            placeholder="sari@kantor.id"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-[var(--ink)]">Kata Sandi</span>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-[10px] bg-[var(--brand)] py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0077ed] disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-label="Memuat" />
          ) : (
            "Masuk"
          )}
        </button>
      </form>

      <p className="text-center text-[11px] text-[var(--ink-2)]">
        Semua akun demo memakai kata sandi <strong>password123</strong>
      </p>
    </motion.div>
  );
}
