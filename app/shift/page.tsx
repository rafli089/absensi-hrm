import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { AssignShift } from "@/components/shift/assign-shift";

export const metadata = { title: "Shift" };

export default async function ShiftPage() {
  const user = await requireUser();
  if (!can(user.role, PERMISSIONS.SHIFT_MANAGE)) {
    return (
      <AppShell user={user} maxWidth="max-w-[1100px]">
        <p className="text-sm text-[var(--ink-2)]">Anda tidak memiliki akses ke halaman ini.</p>
      </AppShell>
    );
  }

  const [shifts, employees] = await Promise.all([
    prisma.shift.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employeeShifts: true } } },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, employeeCode: true, fullName: true },
    }),
  ]);

  return (
    <AppShell user={user} maxWidth="max-w-[1100px]" className="space-y-6">
      <header>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Shift</h1>
        <p className="text-[15px] text-[var(--ink-2)]">{shifts.length} shift terdaftar</p>
      </header>

      <AssignShift
        shifts={shifts.map((s) => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime }))}
        employees={employees}
        tanggalAwal={new Date().toISOString().slice(0, 10)}
      />

      <Card>
        <CardContent className="pt-5">
          {shifts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Calendar className="size-10 text-[var(--ink-2)]/40" aria-hidden />
              <p className="text-[13px] text-[var(--ink-2)]">Belum ada data shift.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Jam</TableHead>
                  <TableHead>Istirahat</TableHead>
                  <TableHead>Toleransi</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge tone="neutral">{s.type === "FIXED" ? "Tetap" : s.type === "ROTATING" ? "Rotasi" : s.type === "FLEXIBLE" ? "Fleksibel" : "Overnight"}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {s.startTime} – {s.endTime}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[var(--ink-2)]">
                      {s.breakStart && s.breakEnd ? `${s.breakStart} – ${s.breakEnd}` : "—"}
                    </TableCell>
                    <TableCell className="font-mono">{s.gracePeriod}m</TableCell>
                    <TableCell className="font-mono">{s._count.employeeShifts}</TableCell>
                    <TableCell>
                      <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>
                        {s.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
