import { prisma } from "@/lib/db";
import { FIELD } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { requireUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { ambilLaporan, ringkas, STATUS_LABEL, tanggal } from "@/lib/laporan/rekap";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileDown, Search } from "lucide-react";
import { TombolCetak } from "@/components/penggajian/tombol-cetak";

export const metadata = { title: "Laporan" };

// Halaman ini untuk REPORT_GENERATE (HR ke atas) atau TEAM_REPORT
// (SUPERVISOR). Supervisor cuma melihat tim sendiri: `departmentId`
// dipaksakan, tanpa tombol pilih departemen/karyawan lain.
// ponytail: "tim sendiri" = `user.departmentId` (departemen milik user).
// Data `departments.managerId` masih null semua, jadi tidak bisa
// menandai departemen yang dia manage. Setelah manager diisi, ganti ke
// managerId + tambah validasi yang sama di /api/reports/attendance.

const STATUS_OPTIONS = Object.entries(STATUS_LABEL);

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{
    dari?: string;
    sampai?: string;
    departemen?: string;
    employeeId?: string;
    status?: string;
  }>;
}) {
  const user = await requireUser();
  const punyaLaporan = can(user.role, PERMISSIONS.REPORT_GENERATE) || can(user.role, PERMISSIONS.TEAM_REPORT);
  if (!punyaLaporan) {
    return (
      <AppShell user={user} maxWidth="max-w-[1200px]">
        <p className="text-body text-[var(--ink-2)]">Anda tidak memiliki akses ke halaman ini.</p>
      </AppShell>
    );
  }

  // Supervisor tanpa departemen tidak punya tim untuk dilaporkan.
  const hanyaTim = !can(user.role, PERMISSIONS.REPORT_GENERATE);
  if (hanyaTim && !user.departmentId) {
    return (
      <AppShell user={user} maxWidth="max-w-[1200px]">
        <p className="text-body text-[var(--ink-2)]">Akun Anda belum terhubung ke departemen.</p>
      </AppShell>
    );
  }

  const sp = await searchParams;
  // Kolom `attendance.date` adalah @db.Date → dibandingkan sebagai tanggal UTC.
  // Default filter harus pakai bagian tanggal UTC juga, kalau tidak antara
  // 00:00-07:00 WIB tanggalnya mundur sehari.
  const sekarang = new Date();
  const hariIni = sekarang.toISOString().slice(0, 10);
  const awalBulan = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), 1)).toISOString().slice(0, 10);

  // Supervisor: filter karyawan/departemen dikunci ke tim sendiri — parameter
  // dari URL diabaikan supaya tidak bisa melihat data di luar tim.
  const f = {
    dari: tanggal(sp.dari) || awalBulan,
    sampai: tanggal(sp.sampai) || hariIni,
    departemen: hanyaTim ? user.departmentId! : sp.departemen || undefined,
    employeeId: hanyaTim ? undefined : sp.employeeId || undefined,
    status: sp.status || undefined,
  };

  const adaFilter = hanyaTim ? true : Boolean(sp.dari || sp.sampai || sp.departemen || sp.employeeId || sp.status);
  const [baris, departemen, karyawan] = await Promise.all([
    adaFilter ? ambilLaporan(f) : Promise.resolve([]),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { isActive: true, ...(hanyaTim ? { departmentId: user.departmentId! } : {}) },
      select: { id: true, employeeCode: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  const ringkasan = ringkas(baris);

  // URL untuk export CSV
  const qs = new URLSearchParams({ dari: f.dari, sampai: f.sampai, format: "csv" });
  if (f.departemen) qs.set("departemen", f.departemen);
  if (f.employeeId) qs.set("employeeId", f.employeeId);
  if (f.status) qs.set("status", f.status);
  const csvUrl = `/api/reports/attendance?${qs.toString()}`;

  return (
    <AppShell user={user} maxWidth="max-w-[1200px]" className="space-y-6">
      <header>
        <h1 className="text-display font-semibold tracking-[-0.02em] text-[var(--ink)]">Laporan</h1>
        <p className="text-body text-[var(--ink-2)]">Rekap kehadiran karyawan</p>
      </header>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-label text-[var(--ink-2)]">Dari</label>
          <input type="date" name="dari" defaultValue={f.dari} className={cn(FIELD, "w-auto")} />
        </div>
        <div>
          <label className="mb-1 block text-label text-[var(--ink-2)]">Sampai</label>
          <input type="date" name="sampai" defaultValue={f.sampai} className={cn(FIELD, "w-auto")} />
        </div>
        {!hanyaTim && (
          <>
            <div>
              <label className="mb-1 block text-label text-[var(--ink-2)]">Departemen</label>
              <select name="departemen" defaultValue={f.departemen} className={cn(FIELD, "w-auto")}>
                <option value="">Semua</option>
                {departemen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-label text-[var(--ink-2)]">Karyawan</label>
              <select name="employeeId" defaultValue={f.employeeId} className={cn(FIELD, "w-auto")}>
                <option value="">Semua</option>
                {karyawan.map((k) => <option key={k.id} value={k.id}>{k.employeeCode} {k.fullName}</option>)}
              </select>
            </div>
          </>
        )}
        <div>
          <label className="mb-1 block text-label text-[var(--ink-2)]">Status</label>
          <select name="status" defaultValue={f.status} className={cn(FIELD, "w-auto")}>
            <option value="">Semua</option>
            {STATUS_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand-hover)] px-4 text-body font-medium text-white transition-colors hover:brightness-95 active:scale-[0.98]">
          <Search className="size-4" aria-hidden /> Filter
        </button>
      </form>

      {adaFilter && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card><CardContent className="pt-4 text-center"><p className="text-display font-semibold">{ringkasan.total}</p><p className="text-label text-[var(--ink-2)]">Total catatan</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-display font-semibold text-[var(--ok-ink)]">{ringkasan.hadir}</p><p className="text-label text-[var(--ink-2)]">Hadir</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-display font-semibold text-[var(--danger-ink)]">{ringkasan.alpa}</p><p className="text-label text-[var(--ink-2)]">Alpa</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-display font-semibold">{ringkasan.terlambatMenit}</p><p className="text-label text-[var(--ink-2)]">Menit terlambat</p></CardContent></Card>
          </div>

          <div className="flex gap-2 print:hidden">
            <a href={csvUrl} className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-black/[0.12] bg-[var(--surface)] px-4 text-body font-medium text-[var(--ink)] transition-colors hover:bg-[var(--bg)] active:scale-[0.98]">
              <FileDown className="size-4" aria-hidden /> Unduh CSV
            </a>
            <TombolCetak />
          </div>

          <Card className="print:border-0 print:p-0">
            <CardContent className="pt-5 print:p-0">
              {baris.length === 0 ? (
                <p className="py-8 text-center text-caption text-[var(--ink-2)]">Tidak ada data untuk filter ini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Terlambat</TableHead>
                        <TableHead>Jam Kerja</TableHead>
                        <TableHead>Lembur</TableHead>
                        <TableHead>Foto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {baris.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="whitespace-nowrap font-mono text-caption">{b.employeeCode}</TableCell>
                          <TableCell className="whitespace-nowrap text-caption">{b.fullName}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-caption">{b.tanggal}</TableCell>
                          <TableCell className="whitespace-nowrap text-caption text-[var(--ink-2)]">{b.shift}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-caption">{b.checkIn ?? "-"}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-caption">{b.checkOut ?? "-"}</TableCell>
                          <TableCell>
                            <Badge tone={b.status === "LATE" ? "warning" : b.status === "ABSENT" ? "danger" : b.status === "PRESENT" || b.status === "OVERTIME" ? "success" : "neutral"}>
                              {STATUS_LABEL[b.status] ?? b.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-caption">{b.lateMinutes > 0 ? `${b.lateMinutes}m` : "-"}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-caption">{b.workMinutes > 0 ? `${Math.floor(b.workMinutes / 60)}j ${b.workMinutes % 60}m` : "-"}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-caption">{b.overtimeMinutes > 0 ? `${b.overtimeMinutes}m` : "-"}</TableCell>
                          <TableCell className="text-caption">{b.adaFoto ? "✓" : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}

