"use client";

import { useState } from "react";
import { FIELD } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Hanya path same-origin. Tanpa ini `?next=//evil.tld` jadi open redirect
  // post-login (phishing), karena router.push menghormati URL absolut.
  const raw = params.get("next");
  const next = raw && /^\/(?![/\\])/.test(raw) ? raw : "/dashboard";

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
      className="w-full max-w-sm space-y-6 rounded-[var(--radius-xl)] bg-[var(--surface)] p-8 shadow-[var(--shadow-md)]"
    >
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-lg">
          <LogIn className="size-7" aria-hidden />
        </div>
        <h1 className="text-h1 font-semibold tracking-[-0.02em] text-[var(--ink)]">Absensi & HR</h1>
        <p className="text-caption text-[var(--ink-2)]">Masuk untuk mengelola absensi karyawan</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-caption font-medium text-[var(--ink)]">Email</span>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
            placeholder="sari@kantor.id"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-caption font-medium text-[var(--ink)]">Kata Sandi</span>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
            placeholder="••••••••"
          />
        </label>

        {error && (
          <div role="alert" className="rounded-[var(--radius-md)] bg-[var(--danger)]/15 px-3 py-2 text-xs text-[var(--danger-ink)]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-hover)] py-2.5 text-body font-medium text-white transition-all duration-200 hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-label="Memuat" />
          ) : (
            "Masuk"
          )}
        </button>
      </form>

      <p className="text-center text-label text-[var(--ink-2)]">
        Semua akun demo memakai kata sandi <strong>password123</strong>
      </p>
    </motion.div>
  );
}
