import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { TombolKalkulasi } from "@/components/penggajian/tombol-kalkulasi";
import { transisiTersedia, LABEL_STATUS } from "@/lib/payroll/status";
import { TombolStatus } from "@/components/penggajian/tombol-status";

export const metadata = { title: "Penggajian" };

export default async function PayrollPage() {
  const user = await requireUser();
  const lihatSemua = can(user.role, PERMISSIONS.PAYROLL_MANAGE);
  // Tombol transisi hanya relevan untuk pengelola payroll. Karyawan yang
  // cuma melihat slip-nya tidak punya izin apa pun untuk menaikkan status.
  const bolehKelola = can(user.role, PERMISSIONS.PAYROLL_MANAGE) || can(user.role, PERMISSIONS.PAYROLL_APPROVE);

  if (!lihatSemua && !user.employeeId) {
    return (
      <AppShell user={user} maxWidth="max-w-[1100px]">
        <p className="text-sm text-[var(--ink-2)]">Akun Anda belum terhubung ke data karyawan.</p>
      </AppShell>
    );
  }

  const where = lihatSemua ? {} : { employeeId: user.employeeId! };

  const payrolls = await prisma.payroll.findMany({
    where,
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    take: 20,
    include: {
      employee: { select: { fullName: true, employeeCode: true } },
    },
  });

  return (
    <AppShell user={user} maxWidth="max-w-[1100px]" className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Penggajian</h1>
          <p className="text-[15px] text-[var(--ink-2)]">
            {lihatSemua ? `${payrolls.length} payroll terbaru` : "Payroll Anda"}
          </p>
        </div>
        {lihatSemua && <TombolKalkulasi />}
      </header>

      <Card>
        <CardContent className="pt-5">
          {payrolls.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Wallet className="size-10 text-[var(--ink-2)]/40" aria-hidden />
              <p className="text-[13px] text-[var(--ink-2)]">
                {lihatSemua
                  ? "Belum ada data payroll. Gunakan tombol kalkulasi untuk menghitung periode berjalan."
                  : "Payroll tersedia setelah HR menghitung dan menyetujui data gaji Anda."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  {lihatSemua && <TableHead>Karyawan</TableHead>}
                  <TableHead>Pokok</TableHead>
                  <TableHead>Netto</TableHead>
                  <TableHead>Hari</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Slip</TableHead>
                  {bolehKelola && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(p.periodStart).toLocaleDateString("id-ID", { month: "short", year: "numeric" })} –{" "}
                      {new Date(p.periodEnd).toLocaleDateString("id-ID", { month: "short", year: "numeric" })}
                    </TableCell>
                    {lihatSemua && (
                      <TableCell>
                        <span className="font-medium">{p.employee?.employeeCode}</span>{" "}
                        <span className="text-[var(--ink-2)]">{p.employee?.fullName}</span>
                      </TableCell>
                    )}
                    <TableCell className="font-mono">Rp {Number(p.basicSalary).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="font-mono font-medium">Rp {Number(p.netSalary).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="font-mono">{p.workDays}</TableCell>
                    <TableCell>
                      <Badge tone={p.status === "PAID" ? "success" : p.status === "APPROVED" ? "warning" : "neutral"}>
                        {LABEL_STATUS[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/penggajian/${p.id}/slip`} className="text-[13px] text-[var(--brand)] hover:underline">
                        Lihat
                      </Link>
                    </TableCell>
                    {bolehKelola && (
                      <TableCell>
                        <TombolStatus
                          payrollId={p.id}
                          targets={transisiTersedia(p.status, (izin) => can(user.role, izin)).map((target) => ({
                            target,
                            // Label status itu kata benda, sedangkan di tombol
                            // yang dibutuhkan aksi: "Ditinjau" bukan "Tandai ditinjau".
                            label: target === "DRAFT" ? "Buka lagi" : `Tandai ${LABEL_STATUS[target].toLowerCase()}`,
                          }))}
                        />
                      </TableCell>
                    )}
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
