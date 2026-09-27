"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Awal & akhir bulan berjalan, WIB. */
function periodeBulanIni() {
  const now = new Date();
  const awal = new Date(now.getFullYear(), now.getMonth(), 1);
  // Hari terakhir bulan: new Date(y, m+1, 0) selalu hari terakhir bulan tersebut.
  const akhir = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { periodStart: iso(awal), periodEnd: iso(akhir) };
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
