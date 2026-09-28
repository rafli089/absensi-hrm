"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTanggal } from "@/lib/utils";

type Pengajuan = {
  id: string;
  date: Date;
  reason: string;
  employee: { fullName: string; employeeCode: string; department: { name: string } | null };
};

/** Tabel approve/reject untuk supervisor & HR. Satu baris = satu hari. */
export function PutuskanCuti({ daftar }: { daftar: Pengajuan[] }) {
  const router = useRouter();
  const [proses, setProses] = useState<string | null>(null);
  const [catatan, setCatatan] = useState<Record<string, string>>({});

  async function putuskan(id: string, keputusan: "APPROVED" | "REJECTED") {
    setProses(id);
    try {
      const r = await fetch("/api/leave", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, keputusan, catatan: catatan[id] }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error ?? "Gagal menyimpan keputusan.");
        return;
      }
      toast.success(keputusan === "APPROVED" ? "Pengajuan disetujui." : "Pengajuan ditolak.");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setProses(null);
    }
  }

  return (
    <div className="mt-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Karyawan</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Alasan</TableHead>
            <TableHead className="w-[180px]">Catatan</TableHead>
            <TableHead className="text-right">Keputusan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {daftar.map((d) => (
            <TableRow key={d.id}>
              <TableCell>
                <span className="font-medium">{d.employee.employeeCode}</span>{" "}
                <span className="text-[var(--ink-2)]">{d.employee.fullName}</span>
                {d.employee.department && (
                  <span className="block text-label text-[var(--ink-2)]">{d.employee.department.name}</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono">{formatTanggal(d.date)}</TableCell>
              <TableCell className="max-w-[200px] truncate">{d.reason}</TableCell>
              <TableCell>
                <Input
                  value={catatan[d.id] ?? ""}
                  onChange={(e) => setCatatan((c) => ({ ...c, [d.id]: e.target.value }))}
                  placeholder="Opsional"
                  maxLength={500}
                  aria-label={`Catatan keputusan untuk ${d.employee.fullName}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    disabled={proses === d.id}
                    onClick={() => putuskan(d.id, "APPROVED")}
                    aria-label={`Setujui cuti ${d.employee.fullName}`}
                  >
                    {proses === d.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                    Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={proses === d.id}
                    onClick={() => putuskan(d.id, "REJECTED")}
                    aria-label={`Tolak cuti ${d.employee.fullName}`}
                  >
                    <X className="size-4" aria-hidden />
                    Tolak
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
