"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Shift = { id: string; name: string; startTime: string; endTime: string };
type Emp = { id: string; employeeCode: string; fullName: string };
type Assign = { id: string; date: string; employee: Emp; shift: Shift };

export function AssignShift({
  shifts,
  employees,
  tanggalAwal,
}: {
  shifts: Shift[];
  employees: Emp[];
  tanggalAwal: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(tanggalAwal);
  const [assign, setAssign] = useState<Assign[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const fetchAssign = useCallback(async () => {
    setMemuat(true);
    try {
      const r = await fetch("/api/employee-shift?date=" + encodeURIComponent(date));
      const d = await r.json();
      if (r.ok) setAssign(d.assign ?? []);
    } catch {
      toast.error("Gagal memuat assign shift.");
    } finally {
      setMemuat(false);
    }
  }, [date]);

  // Simpan pilihan ke shiftId agar panel tidak ter-reset setelah memuat.
  useEffect(() => { fetchAssign(); }, [fetchAssign]);

  async function simpan() {
    if (!employeeId || !shiftId) {
      toast.error("Pilih karyawan dan shift.");
      return;
    }
    setMenyimpan(true);
    try {
      const r = await fetch("/api/employee-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, shiftId, date }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error ?? "Gagal assign.");
        return;
      }
      toast.success(`${d.assign.employee.employeeCode} → ${d.assign.shift.name}`);
      fetchAssign();
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(id: string) {
    const r = await fetch("/api/employee-shift?id=" + encodeURIComponent(id), { method: "DELETE" });
    if (!r.ok) {
      const d = await r.json();
      toast.error(d.error ?? "Gagal hapus.");
      return;
    }
    toast.success("Assign dihapus.");
    fetchAssign();
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <h2 className="text-h3 font-semibold">Penugasan harian</h2>

        <div className="flex gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-[170px]" />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">— karyawan —</option>
            {employees.map((k) => (
              <option key={k.id} value={k.id}>
                {k.employeeCode} {k.fullName}
              </option>
            ))}
          </Select>
          <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            <option value="">— shift —</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startTime}–{s.endTime})
              </option>
            ))}
          </Select>
          <Button type="button" onClick={simpan} disabled={menyimpan || !employeeId || !shiftId}>
            {menyimpan ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
            Assign
          </Button>
        </div>

        {memuat ? (
          <div className="flex items-center gap-2 py-4 text-body text-[var(--ink-2)]">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Memuat...
          </div>
        ) : assign.length === 0 ? (
          <p className="text-caption text-[var(--ink-2)]">Belum ada penugasan untuk tanggal ini.</p>
        ) : (
          <ul className="space-y-2">
            {assign.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-black/[0.08] px-3 py-2 text-body">
                <span>
                  <span className="font-mono font-medium">{a.employee.employeeCode}</span>{" "}
                  <span className="text-[var(--ink-2)]">{a.employee.fullName}</span> ·{" "}
                  <span className="font-medium">{a.shift.name}</span>{" "}
                  <span className="font-mono text-[var(--ink-2)]">
                    {a.shift.startTime}–{a.shift.endTime}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => hapus(a.id)}
                  aria-label="Hapus"
                  className="rounded-full p-1.5 text-[var(--ink-2)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger-ink)]"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
