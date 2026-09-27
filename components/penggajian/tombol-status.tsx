"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * Tombol transisi status payroll (PRD §6.14).
 *
 * Daftar target sudah difilter server-side lewat `transisiTersedia()` di
 * lib/payroll/status.ts — komponen ini tidak menentukan sendiri apa yang
 * boleh diklik, jadi UI dan validasi API tidak bisa berbeda pendapat.
 */
export function TombolStatus({
  payrollId,
  targets,
}: {
  payrollId: string;
  targets: readonly { target: string; label: string }[];
}) {
  const router = useRouter();
  const [menjalankan, setMenjalankan] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pending, mulai] = useTransition();

  if (targets.length === 0) return null;

  async function go(target: string) {
    let alasan: string | undefined;
    if (target === "DRAFT") {
      // Wajib di sisi server juga. Prompt cukup untuk alat internal; kalau
      // nanti butuh alasan panjang, ganti dengan dialog yang punya field.
      const jawab = window.prompt("Alasan membuka kembali payroll ini:", "");
      if (jawab === null) return;
      if (!jawab.trim()) {
        setGalat("Alasan wajib diisi.");
        return;
      }
      alasan = jawab;
    }

    setMenjalankan(target);
    setGalat(null);
    try {
      const r = await fetch(`/api/payroll/${payrollId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alasan ? { status: target, reason: alasan } : { status: target }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setGalat(data.error ?? "Gagal mengubah status payroll.");
        return;
      }
      mulai(() => router.refresh());
    } finally {
      setMenjalankan(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {targets.map((t) => (
          <Button
            key={t.target}
            size="sm"
            variant={t.target === "DRAFT" ? "secondary" : "primary"}
            disabled={menjalankan !== null || pending}
            onClick={() => go(t.target)}
          >
            {menjalankan === t.target ? "Memproses..." : t.label}
          </Button>
        ))}
      </div>
      {galat && <p className="max-w-[260px] text-right text-[12px] text-[var(--danger)]">{galat}</p>}
    </div>
  );
}
