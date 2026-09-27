"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Awal & akhir bulan berjalan, WIB. */
function periodeBulanIni() {
  const now = new Date();
  // Periode disimpan di kolom @db.Date, jadi batasnya harus tanggal UTC.
  // `new Date(y, m, 1)` memakai waktu lokal → di UTC+7 toISOString() mundur
  // sehari, dan periode jadi 31 Agu–31 Agu, bukan 1–31 Sep.
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  // Hari 0 bulan berikutnya = hari terakhir bulan ini.
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    periodStart: iso(new Date(Date.UTC(y, m, 1))),
    periodEnd: iso(new Date(Date.UTC(y, m + 1, 0))),
  };
}

export function TombolKalkulasi() {
  const router = useRouter();
  const [menjalankan, setMenjalankan] = useState(false);

  async function kalkulasi() {
    const { periodStart, periodEnd } = periodeBulanIni();
    setMenjalankan(true);
    try {
      const res = await fetch("/api/payroll/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStart, periodEnd }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menghitung payroll.");
        return;
      }
      if (data.gagal > 0) {
        const gagal = (data.error as { employeeCode: string; reason: string }[]).map((e) => `${e.employeeCode} (${e.reason})`);
        toast.warning(`${data.diproses} dihitung, ${data.gagal} gagal: ` + gagal.join(", "));
      } else {
        toast.success(`${data.diproses} karyawan dihitung.`);
      }
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setMenjalankan(false);
    }
  }

  return (
    <Button type="button" onClick={kalkulasi} disabled={menjalankan}>
      {menjalankan ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Calculator className="size-4" aria-hidden />
      )}
      Hitung bulan ini
    </Button>
  );
}
