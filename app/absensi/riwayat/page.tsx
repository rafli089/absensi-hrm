import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, STATUS_ABSENSI } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTanggal, formatJam, formatMenit } from "@/lib/utils";
import { rentangTanggal, tanggal } from "@/lib/laporan/rekap";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import type { AttendanceStatus } from "@prisma/client";

export const metadata = { title: "Riwayat Absensi" };

const PER_PAGE = 30;

/** Status yang bisa disaring. Satu daftar untuk validasi URL dan isi <select>,
 *  supaya tidak ada status yang bisa difilter via URL tapi tidak lewat UI. */
const STATUS_FILTER: readonly AttendanceStatus[] = [
  "PRESENT", "LATE", "EARLY_LEAVE", "ABSENT", "LEAVE", "SICK", "INCOMPLETE", "REJECTED",
];

/** Riwayat absensi (PRD §7.7). Karyawan: miliknya. Supervisor+: semua.
 *  Filter lengkap PRD §6.10: date, employee, department, shift, status, location. */
export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{
    halaman?: string;
    status?: string;
    employeeId?: string;
    dari?: string;
    sampai?: string;
    departemen?: string;
    shiftId?: string;
    officeId?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const halaman = Math.max(1, Number(sp.halaman) || 1);
  const lihatSemua = can(user.role, PERMISSIONS.ATTENDANCE_VIEW_ALL);

  const statusFilter = STATUS_FILTER.includes(sp.status as AttendanceStatus)
    ? (sp.status as AttendanceStatus)
    : undefined;

  const where: Prisma.AttendanceWhereInput = {
    ...(lihatSemua ? { employeeId: sp.employeeId || undefined } : { employeeId: user.employeeId ?? "" }),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(tanggal(sp.dari) && tanggal(sp.sampai) ? { date: rentangTanggal(tanggal(sp.dari)!, tanggal(sp.sampai)!) } : {}),
    ...(lihatSemua && sp.departemen ? { employee: { departmentId: sp.departemen } } : {}),
    ...(lihatSemua && sp.shiftId ? { shiftId: sp.shiftId } : {}),
    ...(lihatSemua && sp.officeId ? { officeId: sp.officeId } : {}),
  };

  const [total, rows, karyawan, departemen, shift, kantor] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (halaman - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        employee: { select: { fullName: true, employeeCode: true } },
        office: { select: { name: true } },
      },
    }),
    lihatSemua
      ? prisma.employee.findMany({
          where: { isActive: true },
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true, employeeCode: true },
        })
      : Promise.resolve([]),
    lihatSemua
      ? prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    lihatSemua ? prisma.shift.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    lihatSemua
      ? prisma.office.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const totalHalaman = Math.max(1, Math.ceil(total / PER_PAGE));

  const adaFilter =
    Boolean(sp.dari || sp.sampai || sp.departemen || sp.shiftId || sp.officeId || sp.status || sp.employeeId);

  return (
    <AppShell user={user} maxWidth="max-w-[1100px]" className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Riwayat Absensi</h1>
        <p className="text-[15px] text-[var(--ink-2)]">
          {total} catatan · {lihatSemua ? "Semua karyawan" : user.fullName}
        </p>
      </header>

      {/* Filter — URL search params, tanpa state client (deviasi PRD §14) */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1 text-[13px]">
          <span className="text-[var(--ink-2)]">Dari</span>
          <input
            type="date"
            name="dari"
            defaultValue={tanggal(sp.dari) ?? ""}
            className="block h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--ink)]"
          />
        </label>

        <label className="block space-y-1 text-[13px]">
          <span className="text-[var(--ink-2)]">Sampai</span>
          <input
            type="date"
            name="sampai"
            defaultValue={tanggal(sp.sampai) ?? ""}
            className="block h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--ink)]"
          />
        </label>

        {lihatSemua && karyawan.length > 0 && (
          <label className="block space-y-1 text-[13px]">
            <span className="text-[var(--ink-2)]">Karyawan</span>
            <select
              name="employeeId"
              defaultValue={sp.employeeId ?? ""}
              className="block h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--ink)]"
            >
              <option value="">Semua</option>
              {karyawan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.employeeCode} · {k.fullName}
                </option>
              ))}
            </select>
          </label>
        )}

        {lihatSemua && departemen.length > 0 && (
          <label className="block space-y-1 text-[13px]">
            <span className="text-[var(--ink-2)]">Departemen</span>
            <select
              name="departemen"
              defaultValue={sp.departemen ?? ""}
              className="block h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--ink)]"
            >
              <option value="">Semua</option>
              {departemen.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {lihatSemua && shift.length > 0 && (
          <label className="block space-y-1 text-[13px]">
            <span className="text-[var(--ink-2)]">Shift</span>
            <select
              name="shiftId"
              defaultValue={sp.shiftId ?? ""}
              className="block h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--ink)]"
            >
              <option value="">Semua</option>
              {shift.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {lihatSemua && kantor.length > 0 && (
          <label className="block space-y-1 text-[13px]">
            <span className="text-[var(--ink-2)]">Kantor</span>
            <select
              name="officeId"
              defaultValue={sp.officeId ?? ""}
              className="block h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--ink)]"
            >
              <option value="">Semua</option>
              {kantor.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-1 text-[13px]">
          <span className="text-[var(--ink-2)]">Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="block h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--ink)]"
          >
            <option value="">Semua</option>
            {STATUS_FILTER.map((s) => (
              <option key={s} value={s}>
                {STATUS_ABSENSI[s]?.label ?? s}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="h-9 rounded-[10px] bg-[var(--brand)] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed]"
        >
          Terapkan
        </button>
        {adaFilter && (
          <Link href="/absensi/riwayat" className="h-9 leading-9 text-sm text-[var(--ink-2)] underline">
            Reset
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="pt-5">
          {rows.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-2)]">Belum ada data absensi.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  {lihatSemua && <TableHead>Karyawan</TableHead>}
                  <TableHead>Masuk</TableHead>
                  <TableHead>Pulang</TableHead>
                  <TableHead>Durasi</TableHead>
                  <TableHead>Telat</TableHead>
                  <TableHead>Lembur</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Foto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap font-medium">{formatTanggal(a.date)}</TableCell>
                    {lihatSemua && (
                      <TableCell>
                        <span className="font-medium">{a.employee?.employeeCode}</span>{" "}
                        <span className="text-[var(--ink-2)]">{a.employee?.fullName}</span>
                      </TableCell>
                    )}
                    <TableCell className="font-mono">{formatJam(a.checkIn)}</TableCell>
                    <TableCell className="font-mono">{formatJam(a.checkOut)}</TableCell>
                    <TableCell className="font-mono">{formatMenit(a.workMinutes ?? 0)}</TableCell>
                    <TableCell className="font-mono">
                      {a.lateMinutes ? <span className="text-[var(--warn)]">{a.lateMinutes}m</span> : "—"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {a.overtimeMinutes ? <span className="text-[var(--ok)]">{a.overtimeMinutes}m</span> : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATUS_ABSENSI[a.status]?.tone ?? "neutral"}>
                        {STATUS_ABSENSI[a.status]?.label ?? a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {a.photo ? (
                        <a href={a.photo} target="_blank" rel="noreferrer" title="Lihat foto">
                          <img
                            src={a.photo}
                            alt={`Foto absensi ${a.employee?.fullName ?? ""} ${formatTanggal(a.date)}`}
                            loading="lazy"
                            className="size-10 cursor-zoom-in rounded-[8px] object-cover"
                          />
                        </a>
                      ) : (
                        <span className="text-[var(--ink-2)]">—</span>
                      )}
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

  function qs(tambahan: Record<string, string>) {
    const p = new URLSearchParams();
    const filterKeys = ["status", "employeeId", "dari", "sampai", "departemen", "shiftId", "officeId"] as const;
    for (const k of filterKeys) if (sp[k]) p.set(k, sp[k]!);
    for (const [k, v] of Object.entries(tambahan)) p.set(k, v);
    return `/absensi/riwayat?${p.toString()}`;
  }
}
