import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { AjukanCuti } from "@/components/cuti/ajukan-cuti";
import { PutuskanCuti } from "@/components/cuti/putuskan-cuti";
import { formatTanggal } from "@/lib/utils";
import { KUOTA_ANNUAL_PER_TAHUN, LABEL_JENIS_CUTI, sisaKuota } from "@/lib/cuti/engine";
import type { LeaveStatus, LeaveType } from "@prisma/client";

export const metadata = { title: "Cuti" };

const STATUS_CUTI: Record<LeaveStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  PENDING: { label: "Menunggu", tone: "warning" },
  APPROVED: { label: "Disetujui", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "danger" },
  CANCELLED: { label: "Dibatalkan", tone: "neutral" },
};

export default async function CutiPage() {
  const user = await requireUser();
  const bolehAjukan = can(user.role, PERMISSIONS.LEAVE_REQUEST);
  const bolehPutuskan = can(user.role, PERMISSIONS.LEAVE_APPROVE);

  if (!bolehAjukan && !bolehPutuskan) {
    return (
      <AppShell user={user} maxWidth="max-w-[1100px]">
        <p className="text-body text-[var(--ink-2)]">Anda tidak memiliki akses ke halaman ini.</p>
      </AppShell>
    );
  }

  const year = new Date().getFullYear();
  const dari = new Date(year, 0, 1);
  const sampai = new Date(year + 1, 0, 1);

  // Approver melihat semua pengajuan; employee hanya miliknya sendiri.
  const [daftar, terpakai] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: bolehPutuskan ? {} : { employeeId: user.employeeId ?? "__none__" },
      include: {
        employee: { select: { fullName: true, employeeCode: true, department: { select: { name: true } } } },
        approvedBy: { select: { fullName: true } },
      },
      orderBy: [{ date: "desc" }],
      take: 200,
    }),
    user.employeeId
      ? prisma.leaveRequest.aggregate({
          where: { employeeId: user.employeeId, type: "ANNUAL", status: { in: ["APPROVED", "PENDING"] }, date: { gte: dari, lt: sampai } },
          _count: { id: true },
        })
      : null,
  ]);

  const terpakaiAnnual = terpakai?._count.id ?? 0;
  const sisa = sisaKuota(terpakaiAnnual);
  const menunggu = daftar.filter((d) => d.status === "PENDING").length;

  return (
    <AppShell user={user} maxWidth="max-w-[1100px]" className="space-y-6">
      <header>
        <h1 className="text-display font-semibold tracking-[-0.02em] text-[var(--ink)]">Cuti</h1>
        <p className="text-body text-[var(--ink-2)]">
          {bolehPutuskan ? `${menunggu} pengajuan menunggu keputusan` : `Sisa kuota cuti tahunan ${sisa} hari`}
        </p>
      </header>

      {user.employeeId && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
            <div>
              <p className="text-label text-[var(--ink-2)]">Kuota cuti tahunan {year}</p>
              <p className="text-h2 font-semibold tabular-nums text-[var(--ink)]">
                {sisa}
                <span className="text-h3 font-normal text-[var(--ink-2)]"> / {KUOTA_ANNUAL_PER_TAHUN} hari tersisa</span>
              </p>
            </div>
            <AjukanCuti />
          </CardContent>
        </Card>
      )}

      {bolehPutuskan && menunggu > 0 && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-h3 font-semibold text-[var(--ink)]">Perlu keputusan Anda</h2>
            <PutuskanCuti daftar={daftar.filter((d) => d.status === "PENDING")} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          <h2 className="text-h3 font-semibold text-[var(--ink)]">
            {bolehPutuskan ? "Semua pengajuan" : "Riwayat pengajuan saya"}
          </h2>
          {daftar.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays className="size-10 text-[var(--ink-2)]/40" aria-hidden />
              <p className="text-caption text-[var(--ink-2)]">Belum ada pengajuan cuti.</p>
            </div>
          ) : (
            <div className="mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    {bolehPutuskan && <TableHead>Karyawan</TableHead>}
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Diputusan oleh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daftar.map((d) => (
                    <TableRow key={d.id}>
                      {bolehPutuskan && (
                        <TableCell>
                          <span className="font-medium">{d.employee.employeeCode}</span>{" "}
                          <span className="text-[var(--ink-2)]">{d.employee.fullName}</span>
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap font-mono">{formatTanggal(d.date)}</TableCell>
                      <TableCell>{LABEL_JENIS_CUTI[d.type as LeaveType]}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-[var(--ink-2)]">{d.reason}</TableCell>
                      <TableCell>
                        <Badge tone={STATUS_CUTI[d.status].tone}>{STATUS_CUTI[d.status].label}</Badge>
                      </TableCell>
                      <TableCell className="text-[var(--ink-2)]">{d.approvedBy?.fullName ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
