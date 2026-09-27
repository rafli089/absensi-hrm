import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";

export const metadata = { title: "Penggajian" };

export default async function PayrollPage() {
  const user = await requireUser();
  const lihatSemua = can(user.role, PERMISSIONS.PAYROLL_MANAGE);

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
      <header>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Penggajian</h1>
        <p className="text-[15px] text-[var(--ink-2)]">
          {lihatSemua ? `${payrolls.length} payroll terbaru` : "Payroll Anda"}
        </p>
      </header>

      <Card>
        <CardContent className="pt-5">
          {payrolls.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Wallet className="size-10 text-[var(--ink-2)]/40" aria-hidden />
              <p className="text-[13px] text-[var(--ink-2)]">
                {lihatSemua ? "Belum ada data payroll." : "Payroll tersedia setelah HR membuat dan menyetujui data gaji Anda."}
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
                        {p.status === "PAID" ? "Dibayar" : p.status === "APPROVED" ? "Disetujui" : p.status === "DRAFT" ? "Draft" : p.status}
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
