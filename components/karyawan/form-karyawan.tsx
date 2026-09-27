"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Opsi = { id: string; name: string };

const STATUS = [
  { value: "PERMANENT", label: "Tetap" },
  { value: "CONTRACT", label: "Kontrak" },
  { value: "INTERN", label: "Magang" },
  { value: "FREELANCE", label: "Freelance" },
] as const;

const kelasInput =
  "h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-2)]/60 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20";

export function FormKaryawan({
  departemen,
  jabatan,
  kodeBerikutnya,
}: {
  departemen: Opsi[];
  jabatan: Opsi[];
  kodeBerikutnya: string;
}) {
  const router = useRouter();
  const [menyimpan, setMenyimpan] = useState(false);

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setMenyimpan(true);
    try {
      const res = await fetch("/api/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode: f.get("employeeCode"),
          fullName: f.get("fullName"),
          email: f.get("email"),
          nik: f.get("nik"),
          phone: f.get("phone"),
          departmentId: f.get("departmentId"),
          positionId: f.get("positionId"),
          joinDate: f.get("joinDate"),
          employmentStatus: f.get("employmentStatus"),
          bankName: f.get("bankName"),
          bankAccount: f.get("bankAccount"),
          taxNumber: f.get("taxNumber"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menyimpan.");
        return;
      }
      toast.success(`Karyawan ${data.karyawan.fullName} ditambahkan.`);
      router.push("/karyawan");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={simpan} className="space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="size-5 text-[var(--brand)]" aria-hidden />
            <h2 className="text-[15px] font-semibold">Data karyawan</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Label className="block space-y-1.5">
              <span>Kode</span>
              <Input name="employeeCode" defaultValue={kodeBerikutnya} className={kelasInput} required />
            </Label>
            <Label className="block space-y-1.5">
              <span>Nama lengkap</span>
              <Input name="fullName" placeholder="Budi Santoso" className={kelasInput} required />
            </Label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="block space-y-1.5">
              <span>Email</span>
              <Input name="email" type="email" placeholder="budi@kantor.id" className={kelasInput} />
            </Label>
            <Label className="block space-y-1.5">
              <span>NIK (16 digit)</span>
              <Input name="nik" inputMode="numeric" maxLength={16} placeholder="3201234567890001" className={kelasInput} />
            </Label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="block space-y-1.5">
              <span>Telepon</span>
              <Input name="phone" inputMode="tel" placeholder="08123456789" className={kelasInput} />
            </Label>
            <Label className="block space-y-1.5">
              <span>Tanggal masuk</span>
              <Input name="joinDate" type="date" className={kelasInput} required />
            </Label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Label className="block space-y-1.5">
              <span>Departemen</span>
              <select name="departmentId" defaultValue="" className={kelasInput}>
                <option value="">— belum —</option>
                {departemen.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Label>
            <Label className="block space-y-1.5">
              <span>Jabatan</span>
              <select name="positionId" defaultValue="" className={kelasInput}>
                <option value="">— belum —</option>
                {jabatan.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Label>
            <Label className="block space-y-1.5">
              <span>Status kerja</span>
              <select name="employmentStatus" defaultValue="PERMANENT" className={kelasInput}>
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Label>
          </div>

          <fieldset className="space-y-3 rounded-[12px] border border-[var(--border)] p-4">
            <legend className="px-1 text-[12px] text-[var(--ink-2)]">Data gaji (opsional, bisa diisi nanti)</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Label className="block space-y-1.5">
                <span>Bank</span>
                <Input name="bankName" placeholder="BCA" className={kelasInput} />
              </Label>
              <Label className="block space-y-1.5">
                <span>Nomor rekening</span>
                <Input name="bankAccount" inputMode="numeric" className={kelasInput} />
              </Label>
              <Label className="block space-y-1.5">
                <span>NPWP</span>
                <Input name="taxNumber" inputMode="numeric" className={kelasInput} />
              </Label>
            </div>
          </fieldset>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>Batal</Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Simpan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
