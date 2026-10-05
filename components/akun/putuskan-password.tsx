"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTanggal } from "@/lib/utils";

type Pengajuan = {
  id: string;
  createdAt: Date;
  user: { email: string; username: string };
};

/** Tabel approve/reject pengajuan ganti kata sandi. Dipakai SPV/HR/Admin. */
export function PutuskanPassword({ daftar }: { daftar: Pengajuan[] }) {
  const router = useRouter();
  const [proses, setProses] = useState<string | null>(null);

  async function putuskan(id: string, keputusan: "APPROVED" | "REJECTED") {
    setProses(id);
    try {
      const r = await fetch(`/api/auth/password/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keputusan }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(d.error ?? "Gagal menyimpan keputusan.");
        return;
      }
      toast.success(keputusan === "APPROVED" ? "Kata sandi pemohon diperbarui." : "Pengajuan ditolak.");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setProses(null);
    }
  }

  return (
    <ul className="divide-y divide-[var(--border)]/60">
      {daftar.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="text-body font-medium text-[var(--ink)] truncate">{d.user.email}</p>
            <p className="text-label text-[var(--ink-2)]">
              @{d.user.username} · diajukan {formatTanggal(d.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              disabled={proses === d.id}
              onClick={() => putuskan(d.id, "APPROVED")}
              aria-label={`Setujui pengajuan kata sandi ${d.user.email}`}
            >
              {proses === d.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              Setujui
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={proses === d.id}
              onClick={() => putuskan(d.id, "REJECTED")}
              aria-label={`Tolak pengajuan kata sandi ${d.user.email}`}
            >
              <X className="size-4" aria-hidden />
              Tolak
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
