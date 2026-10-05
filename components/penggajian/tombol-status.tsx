"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Tombol transisi status payroll (PRD §6.14).
 *
 * Daftar target sudah difilter server-side lewat `transisiTersedia()` di
 * lib/payroll/status.ts — komponen ini tidak menentukan sendiri apa yang
 * boleh diklik, jadi UI dan validasi API tidak bisa berbeda pendapat.
 *
 * Membuka kembali (DRAFT) wajib alasan — ditanyai lewat dialog, bukan
 * `window.prompt` (mengganggu, tidak sesuai aesthetic aplikasi).
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

  // Dialog alasan hanya untuk DRAFT.
  const perluAlasan = targets.find((t) => t.target === "DRAFT");
  const [dialogTerbuka, setDialogTerbuka] = useState(false);
  const alasanRef = useRef<HTMLInputElement>(null);

  if (targets.length === 0) return null;

  async function kirim(target: string, alasan?: string) {
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

  function klik(target: string) {
    if (target === "DRAFT") {
      setDialogTerbuka(true);
      return;
    }
    void kirim(target);
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
            onClick={() => klik(t.target)}
          >
            {menjalankan === t.target ? "Memproses..." : t.label}
          </Button>
        ))}
      </div>
      {galat && <p className="max-w-[260px] text-right text-label text-[var(--danger-ink)]">{galat}</p>}

      {perluAlasan && (
        <Dialog open={dialogTerbuka} onOpenChange={setDialogTerbuka}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{perluAlasan.label}</DialogTitle>
              <DialogDescription>
                Beri alasan membuka kembali payroll ini — akan tercatat di audit trail.
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 pt-4">
              <label htmlFor="alasan-payroll" className="mb-1 block text-label text-[var(--ink-2)]">
                Alasan
              </label>
              <Input
                id="alasan-payroll"
                ref={alasanRef}
                placeholder="Misal: ada revisi lembur minggu lalu…"
                autoFocus
              />
              <div aria-live="polite">
                {galat && <p className="mt-2 text-label text-[var(--danger-ink)]">{galat}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogTerbuka(false)}>
                Batal
              </Button>
              <Button
                disabled={menjalankan !== null}
                onClick={() => {
                  const alasan = alasanRef.current?.value.trim() ?? "";
                  if (!alasan) {
                    setGalat("Alasan wajib diisi.");
                    return;
                  }
                  setDialogTerbuka(false);
                  void kirim("DRAFT", alasan);
                }}
              >
                {menjalankan === "DRAFT" ? "Memproses..." : "Konfirmasi"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}