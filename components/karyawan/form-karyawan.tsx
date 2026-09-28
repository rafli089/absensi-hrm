"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Opsi = { id: string; name: string };

/** Nilai awal untuk mode edit. Tanggal dari server sudah UTC midnight, jadi
 *  `.toISOString().slice(0,10)` cocok dengan format <input type="date">. */
export type AwalKaryawan = {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  nik: string | null;
  phone: string | null;
  joinDate: string;
  resignDate: string | null;
  employmentStatus: string;
  departmentId: string | null;
  positionId: string | null;
  bankName: string | null;
  bankAccount: string | null;
  taxNumber: string | null;
};

const STATUS = [
  { value: "PERMANENT", label: "Tetap" },
  { value: "CONTRACT", label: "Kontrak" },
  { value: "INTERN", label: "Magang" },
  { value: "FREELANCE", label: "Freelance" },
] as const;
const tanggal = (iso: Date) => iso.toISOString().slice(0, 10);

export function FormKaryawan({
  departemen,
  jabatan,
  kodeBerikutnya,
  awal,
}: {
  departemen: Opsi[];
  jabatan: Opsi[];
  kodeBerikutnya: string;
  /** Ada = mode edit. Absent = mode tambah. */
  awal?: AwalKaryawan;
}) {
  const router = useRouter();
  const [menyimpan, setMenyimpan] = useState(false);
  const modeEdit = Boolean(awal);

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setMenyimpan(true);
    try {
      const res = await fetch(modeEdit ? `/api/employee/${awal!.id}` : "/api/employee", {
        method: modeEdit ? "PUT" : "POST",
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
          employmentEndDate: f.get("employmentEndDate"),
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
      toast.success(modeEdit ? "Data karyawan diperbarui." : `Karyawan ${data.karyawan.fullName} ditambahkan.`);
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
            {modeEdit ? (
              <Save className="size-5 text-[var(--brand)]" aria-hidden />
            ) : (
              <UserPlus className="size-5 text-[var(--brand)]" aria-hidden />
            )}
            <h2 className="text-h3 font-semibold">Data karyawan</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Label className="block space-y-1.5">
              <span>Kode</span>
              <Input
                name="employeeCode"
                defaultValue={awal?.employeeCode ?? kodeBerikutnya}
                required
              />
            </Label>
            <Label className="block space-y-1.5">
              <span>Nama lengkap</span>
              <Input
                name="fullName"
                defaultValue={awal?.fullName}
                placeholder="Budi Santoso"
                required
              />
            </Label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="block space-y-1.5">
              <span>Email</span>
              <Input
                name="email"
                type="email"
                defaultValue={awal?.email ?? ""}
                placeholder="budi@kantor.id"
              />
            </Label>
            <Label className="block space-y-1.5">
              <span>NIK (16 digit)</span>
              <Input
                name="nik"
                inputMode="numeric"
                maxLength={16}
                defaultValue={awal?.nik ?? ""}
                placeholder="3201234567890001"
              />
            </Label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Label className="block space-y-1.5">
              <span>Telepon</span>
              <Input
                name="phone"
                inputMode="tel"
                defaultValue={awal?.phone ?? ""}
                placeholder="08123456789"
              />
            </Label>
            <Label className="block space-y-1.5">
              <span>Tanggal masuk</span>
              <Input
                name="joinDate"
                type="date"
                defaultValue={awal ? tanggal(new Date(awal.joinDate)) : ""}
                required
              />
            </Label>
            <Label className="block space-y-1.5">
              <span>Tanggal berhenti</span>
              <Input
                name="employmentEndDate"
                type="date"
                defaultValue={awal?.resignDate ? tanggal(new Date(awal.resignDate)) : ""}
              />
            </Label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Label className="block space-y-1.5">
              <span>Departemen</span>
              <Select
                name="departmentId"
                defaultValue={awal?.departmentId ?? ""}
              >
                <option value="">— belum —</option>
                {departemen.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Label>
            <Label className="block space-y-1.5">
              <span>Jabatan</span>
              <Select name="positionId" defaultValue={awal?.positionId ?? ""}>
                <option value="">— belum —</option>
                {jabatan.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Label>
            <Label className="block space-y-1.5">
              <span>Status kerja</span>
              <Select
                name="employmentStatus"
                defaultValue={awal?.employmentStatus ?? "PERMANENT"}
              >
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Label>
          </div>

          <fieldset className="space-y-3 rounded-[var(--radius-lg)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
            <legend className="px-1 text-label text-[var(--ink-2)]">Data gaji (opsional, bisa diisi nanti)</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Label className="block space-y-1.5">
                <span>Bank</span>
                <Input name="bankName" defaultValue={awal?.bankName ?? ""} placeholder="BCA" />
              </Label>
              <Label className="block space-y-1.5">
                <span>Nomor rekening</span>
                <Input
                  name="bankAccount"
                  inputMode="numeric"
                  defaultValue={awal?.bankAccount ?? ""}
                />
              </Label>
              <Label className="block space-y-1.5">
                <span>NPWP</span>
                <Input name="taxNumber" inputMode="numeric" defaultValue={awal?.taxNumber ?? ""} />
              </Label>
            </div>
          </fieldset>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Batal
            </Button>
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : modeEdit ? (
                "Simpan Perubahan"
              ) : (
                "Simpan"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
