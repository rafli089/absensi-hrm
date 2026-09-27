"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Shift = { id: string; name: string; startTime: string; endTime: string };
type Emp = { id: string; employeeCode: string; fullName: string };
type Assign = { id: string; date: string; employee: Emp; shift: Shift };

const kelasInput =
  "h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-2)]/60 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20";

const tanggal = (d: Date) => d.toISOString().slice(0, 10);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h2 className="text-[15px] font-semibold">Penugasan harian</h2>

        <div className="flex gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={kelasInput + " max-w-[170px]"} />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={kelasInput}>
            <option value="">— karyawan —</option>
            {employees.map((k) => (
              <option key={k.id} value={k.id}>
                {k.employeeCode} {k.fullName}
              </option>
            ))}
          </select>
          <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={kelasInput}>
            <option value="">— shift —</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startTime}–{s.endTime})
              </option>
            ))}
          </select>
          <Button type="button" onClick={simpan} disabled={menyimpan || !employeeId || !shiftId}>
            {menyimpan ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
            Assign
          </Button>
        </div>

        {memuat ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--ink-2)]">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Memuat...
          </div>
        ) : assign.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-2)]">Belum ada penugasan untuk tanggal ini.</p>
        ) : (
          <ul className="space-y-2">
            {assign.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm">
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
                  className="rounded-[8px] p-1.5 text-[var(--ink-2)] hover:bg-[var(--bg)] hover:text-[#e02020]"
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
