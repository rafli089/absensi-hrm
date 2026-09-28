"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, Clock, Loader2, MapPin } from "lucide-react";
import { AmbilFoto, type HasilFoto } from "./ambil-foto";
import { ambilLokasi } from "./lokasi";

type HasilAbsensi = {
  status: string;
  lateMinutes: number;
  workMinutes?: number;
  earlyLeaveMinutes?: number;
};

export function KartuAbsen({ mode }: { mode: "check-in" | "check-out" }) {
  const router = useRouter();
  const [memproses, setMemproses] = useState(false);
  const [statusLokasi, setStatusLokasi] = useState<{ ok: boolean; teks: string } | null>(null);

  async function proses(hasil: HasilFoto) {
    setMemproses(true);
    try {
      const gps = await ambilLokasi();
      setStatusLokasi({ ok: gps.ok, teks: gps.ok ? "Lokasi diperoleh" : gps.alasan });
      if (!gps.ok) {
        toast.error(gps.alasan);
        return;
      }

      const res = await fetch(`/api/attendance/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...gps.posisi, photo: hasil.foto, takenAt: hasil.diambilPada, deviceId: idPerangkat() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Absensi gagal.");
        return;
      }

      const a = data.attendance as HasilAbsensi;
      toast.success(
        mode === "check-in" ? "Absen masuk berhasil" : "Absen pulang berhasil",
        {
          description: [
            a.lateMinutes > 0 ? `Terlambat ${a.lateMinutes} menit` : null,
            a.workMinutes ? `Durasi kerja ${Math.floor(a.workMinutes / 60)}j ${a.workMinutes % 60}m` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        },
      );
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan saat melakukan absensi. Silakan coba kembali.");
    } finally {
      setMemproses(false);
    }
  }

  const biru = mode === "check-in";
  return (
    <div className={`rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-[var(--shadow-sm)] p-5`}>
      <div className="space-y-4">
        <div className={`text-center ${biru ? "text-[var(--ink)]" : "text-[var(--ok-ink)]"}`}>
          {biru ? (
            <>
              <CheckCircle className="mx-auto mb-2 size-12 text-[var(--brand)]" aria-hidden />
              <p className="text-h2 font-medium">Siap untuk Check-in?</p>
              <p className="text-body text-[var(--ink-2)]">Ambil foto di lokasi &amp; pastikan GPS aktif.</p>
            </>
          ) : (
            <>
              <Clock className="mx-auto mb-2 size-12" aria-hidden />
              <p className="text-h2 font-medium">Sedang Bekerja</p>
              <p className="text-body opacity-90">Check-out untuk mengakhiri shift.</p>
            </>
          )}
        </div>

        {memproses && (
          <div className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-black/[0.04] px-3 py-2 text-body text-[var(--ink-2)]" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Mengirim foto dan lokasi...
          </div>
        )}

        {statusLokasi && (
          <div className={`flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-label ${statusLokasi.ok ? "bg-[var(--ok)]/15 text-[var(--ok-ink)]" : "bg-[var(--danger)]/15 text-[var(--danger-ink)]"}`}>
            <MapPin className="size-3.5" aria-hidden />
            {statusLokasi.teks}
          </div>
        )}

        <AmbilFoto onSelesai={proses} onBatal={() => router.refresh()} />
      </div>
    </div>
  );
}

function idPerangkat(): string {
  const KUNCI = "absensi_device_id";
  let id = localStorage.getItem(KUNCI);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KUNCI, id);
  }
  return id;
}
