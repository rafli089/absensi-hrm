import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { SlipGaji } from "@/components/penggajian/slip-gaji";

export const metadata = { title: "Slip Gaji" };

/**
 * Slip gaji cetak (PRD §6.16).
 *
 * Server-render dari `payrolls` + `payroll_items`. Tabel `payslips` tidak
 * dipakai: `fileUrl` bernilai null dan tidak ada workflow publikasi di MVP,
 * jadi menambah baris Payslip hanya menambah state tanpa gunanya.
 */
export default async function SlipGajiPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          department: { select: { name: true } },
          position: { select: { name: true } },
          bankName: true,
          bankAccount: true,
        },
      },
      items: { orderBy: { name: "asc" } },
      // Nama orang ada di Employee, tidak di User — jadi lewat relasi.
      // Slip memuat nomor rekening, jadi cukup nama; tidak perlu username/email.
      approvedBy: { select: { employee: { select: { fullName: true } } } },
    },
  });

  if (!payroll) notFound();

  // Milik sendiri, atau pemangku payroll. Menebak id lewat URL tidak cukup —
  // slip gaji memuat nomor rekening.
  const milikSendiri = user.employeeId === payroll.employeeId;
  if (!milikSendiri && !can(user.role, PERMISSIONS.PAYROLL_MANAGE)) {
    return <p className="p-8 text-body text-[var(--ink-2)]">Anda tidak memiliki akses ke slip gaji ini.</p>;
  }

  const kantor = await prisma.office.findFirst({ where: { isActive: true }, select: { name: true, address: true } });

  return (
    <SlipGaji
      payroll={{
        id: payroll.id,
        periodStart: payroll.periodStart.toISOString(),
        periodEnd: payroll.periodEnd.toISOString(),
        basicSalary: payroll.basicSalary.toString(),
        totalAllowance: payroll.totalAllowance.toString(),
        totalOvertime: payroll.totalOvertime.toString(),
        totalBonus: payroll.totalBonus.toString(),
        totalDeduction: payroll.totalDeduction.toString(),
        tax: payroll.tax.toString(),
        netSalary: payroll.netSalary.toString(),
        workDays: payroll.workDays,
        lateMinutes: payroll.lateMinutes,
        absentDays: payroll.absentDays,
        status: payroll.status,
        // User tanpa employee (akun admin murni) tidak punya nama untuk dicetak.
        approvedByName: payroll.approvedBy?.employee?.fullName ?? null,
        approvedAt: payroll.approvedAt?.toISOString() ?? null,
        employee: payroll.employee,
        items: payroll.items.map((i) => ({ id: i.id, name: i.name, amount: i.amount.toString(), note: i.note })),
      }}
      kantor={kantor}
    />
  );
}
