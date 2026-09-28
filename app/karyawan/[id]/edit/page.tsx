import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { FormKaryawan } from "@/components/karyawan/form-karyawan";

export const metadata = { title: "Edit Karyawan" };

export default async function EditKaryawanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user.role, PERMISSIONS.EMPLOYEE_MANAGE)) {
    return (
      <AppShell user={user} maxWidth="max-w-[700px]">
        <p className="text-body text-[var(--ink-2)]">Anda tidak memiliki akses ke halaman ini.</p>
      </AppShell>
    );
  }

  const { id } = await params;
  const [karyawan, departemen, jabatan] = await Promise.all([
    prisma.employee.findUnique({ where: { id } }),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  if (!karyawan) notFound();

  return (
    <AppShell user={user} maxWidth="max-w-[700px]" className="space-y-6">
      <header className="space-y-2">
        <Link href="/karyawan" className="text-caption text-[var(--ink-2)] hover:text-[var(--ink)]">
          &larr; Karyawan
        </Link>
        <h1 className="text-display font-semibold tracking-[-0.02em] text-[var(--ink)]">
          {karyawan.fullName}
        </h1>
        <p className="text-body text-[var(--ink-2)]">
          {karyawan.employeeCode} &middot;{" "}
          {karyawan.isActive ? "Aktif" : "Nonaktif — tidak masuk payroll berikutnya"}
        </p>
      </header>

      <FormKaryawan
        departemen={departemen}
        jabatan={jabatan}
        kodeBerikutnya={karyawan.employeeCode}
        awal={{
          id: karyawan.id,
          employeeCode: karyawan.employeeCode,
          fullName: karyawan.fullName,
          email: karyawan.email,
          nik: karyawan.nik,
          phone: karyawan.phone,
          joinDate: karyawan.joinDate.toISOString(),
          resignDate: karyawan.resignDate?.toISOString() ?? null,
          employmentStatus: karyawan.employmentStatus,
          departmentId: karyawan.departmentId,
          positionId: karyawan.positionId,
          bankName: karyawan.bankName,
          bankAccount: karyawan.bankAccount,
          taxNumber: karyawan.taxNumber,
        }}
      />
    </AppShell>
  );
}

