import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatTanggal } from "@/lib/utils";
import { Users, Search, UserPlus } from "lucide-react";

export const metadata = { title: "Karyawan" };

const PER_PAGE = 20;

export default async function KaryawanPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; halaman?: string }>;
}) {
  const user = await requireUser();
  if (!can(user.role, PERMISSIONS.ATTENDANCE_VIEW_ALL)) {
    return (
      <AppShell user={user} maxWidth="max-w-[1100px]">
        <p className="text-sm text-[var(--ink-2)]">Anda tidak memiliki akses ke halaman ini.</p>
      </AppShell>
    );
  }

  const sp = await searchParams;
  const halaman = Math.max(1, Number(sp.halaman) || 1);
  const q = sp.q?.trim() ?? "";

  const where = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { employeeCode: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { nik: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (halaman - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        department: { select: { name: true } },
        position: { select: { name: true } },
        user: { select: { role: true, status: true } },
      },
    }),
  ]);

  const totalHalaman = Math.max(1, Math.ceil(total / PER_PAGE));

  function qs(tambahan: Record<string, string>) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(tambahan)) p.set(k, v);
    return `/karyawan?${p.toString()}`;
  }

  const bolehTambah = can(user.role, PERMISSIONS.EMPLOYEE_MANAGE);

  return (
    <AppShell user={user} maxWidth="max-w-[1100px]" className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Karyawan</h1>
          <p className="text-[15px] text-[var(--ink-2)]">{total} karyawan terdaftar</p>
        </div>
        {bolehTambah && (
          <Link
            href="/karyawan/tambah"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] bg-[var(--brand)] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed]"
          >
            <UserPlus className="size-4" aria-hidden />
            Tambah
          </Link>
        )}
      </header>

      <form method="GET" className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-2)]" aria-hidden />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Cari nama, kode, email, NIK..."
            className="h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-2)]/60 outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-[10px] bg-[var(--brand)] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed]"
        >
          Cari
        </button>
        {q && (
          <Link href="/karyawan" className="h-9 leading-9 text-sm text-[var(--ink-2)] underline">
            Reset
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="pt-5">
          {employees.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Users className="size-10 text-[var(--ink-2)]/40" aria-hidden />
              <p className="text-[13px] text-[var(--ink-2)]">Belum ada data karyawan.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Departemen</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>Masuk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap font-mono font-medium">{e.employeeCode}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{e.fullName}</p>
                        {e.email && <p className="text-[12px] text-[var(--ink-2)]">{e.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--ink-2)]">{e.department?.name ?? "—"}</TableCell>
                    <TableCell className="text-[var(--ink-2)]">{e.position?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge tone={e.isActive ? "success" : "neutral"}>
                        {e.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {e.user ? (
                        <Badge tone={e.user.status === "ACTIVE" ? "success" : "danger"}>
                          {e.user.role === "SUPER_ADMIN" ? "Super Admin" : e.user.role === "ADMIN" ? "Admin" : e.user.role === "HR" ? "HR" : e.user.role === "SUPERVISOR" ? "Supervisor" : "Karyawan"}
                        </Badge>
                      ) : (
                        <span className="text-[var(--ink-2)]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[var(--ink-2)]">
                      {formatTanggal(e.joinDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalHalaman > 1 && (
        <nav className="flex items-center justify-between text-[13px]" aria-label="Navigasi halaman">
          {halaman > 1 ? (
            <Link href={qs({ halaman: String(halaman - 1) })} className="rounded-[10px] px-3 py-1.5 hover:bg-[var(--surface)]">
              Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[var(--ink-2)]">
            Halaman {halaman} dari {totalHalaman}
          </span>
          {halaman < totalHalaman ? (
            <Link href={qs({ halaman: String(halaman + 1) })} className="rounded-[10px] px-3 py-1.5 hover:bg-[var(--surface)]">
              Berikutnya
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </AppShell>
  );
}
