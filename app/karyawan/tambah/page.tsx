import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { FormKaryawan } from "@/components/karyawan/form-karyawan";
import Link from "next/link";

export const metadata = { title: "Tambah Karyawan" };

export default async function TambahKaryawanPage() {
  const user = await requireUser();
  if (!can(user.role, PERMISSIONS.EMPLOYEE_MANAGE)) {
    return (
      <AppShell user={user} maxWidth="max-w-[700px]">
        <p className="text-body text-[var(--ink-2)]">Anda tidak memiliki akses ke halaman ini.</p>
      </AppShell>
    );
  }

  const [departemen, jabatan, terakhir] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.employee.findFirst({ where: { employeeCode: { startsWith: "EMP-" } }, orderBy: { employeeCode: "desc" }, select: { employeeCode: true } }),
  ]);

  // Nomor urut dari kode terbesar, bukan jumlah baris. Kalau ada EMP-001 lewis
  // atau dihapus, count() akan menghasilkan kode yang sudah dipakai.
  const urut = Number(terakhir?.employeeCode.slice(4) ?? 0) + 1;

  return (
    <AppShell user={user} maxWidth="max-w-[700px]" className="space-y-6">
      <header className="space-y-2">
        <Link href="/karyawan" className="text-caption text-[var(--ink-2)] hover:text-[var(--ink)]">
          &larr; Karyawan
        </Link>
        <h1 className="text-display font-semibold tracking-[-0.02em] text-[var(--ink)]">Tambah Karyawan</h1>
        <p className="text-body text-[var(--ink-2)]">
          Data gaji boleh diisi nanti, tapi departemen dan jabatan memudahkan filter riwayat.
        </p>
      </header>

      <FormKaryawan departemen={departemen} jabatan={jabatan} kodeBerikutnya={`EMP-${String(urut).padStart(3, "0")}`} />
    </AppShell>
  );
}
