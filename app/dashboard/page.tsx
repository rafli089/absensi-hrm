import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { STAFF_ROLES } from "@/lib/auth/permissions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, STATUS_ABSENSI } from "@/components/ui/badge";
import Link from "next/link";
import { formatJam, formatMenit, formatTanggal, formatTanggalPanjang, todayDate } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, CalendarOff, Clock3 } from "lucide-react";

/** Ringkasan hari ini untuk atasan (PRD §10.3). */
async function RingkasanAdmin({ user }: { user: Awaited<ReturnType<typeof requireUser>> }) {
  const hariIni = todayDate();
  const [hadir, terlambat, alpa, cuti, terbaru] = await Promise.all([
    prisma.attendance.count({ where: { date: hariIni, status: "PRESENT" } }),
    prisma.attendance.count({ where: { date: hariIni, status: "LATE" } }),
    prisma.attendance.count({ where: { date: hariIni, status: "ABSENT" } }),
    prisma.attendance.count({ where: { date: hariIni, status: { in: ["LEAVE", "SICK"] } } }),
    prisma.attendance.findMany({
      where: { date: hariIni },
      orderBy: { checkIn: "desc" },
      take: 10,
      include: { employee: { select: { fullName: true, employeeCode: true } } },
    }),
  ]);

  const kartu = [
    { label: "Hadir", value: hadir, tone: "success" as const, Icon: CheckCircle2 },
    { label: "Terlambat", value: terlambat, tone: "warning" as const, Icon: Clock },
    { label: "Alpa", value: alpa, tone: "danger" as const, Icon: XCircle },
    { label: "Cuti / Sakit", value: cuti, tone: "info" as const, Icon: CalendarOff },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-semibold tracking-[-0.02em] text-[var(--ink)]">Halo, {user.fullName}</h1>
        <p className="text-caption text-[var(--ink-2)]">{formatTanggalPanjang(new Date())}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kartu.map(({ label, value, tone, Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between pt-5">
              <div>
                <p className="text-caption text-[var(--ink-2)]">{label}</p>
                <p className="text-display font-semibold tracking-[-0.02em] text-[var(--ink)]">{value}</p>
              </div>
              <Badge tone={tone}>
                <Icon className="size-3.5" aria-hidden />
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-4 text-h3 font-semibold">Absensi Terbaru</h2>
          {terbaru.length === 0 ? (
            <p className="text-caption text-[var(--ink-2)]">Belum ada yang absen hari ini.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]/60">
              {terbaru.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-body font-medium text-[var(--ink)]">{a.employee?.fullName}</p>
                    <p className="text-label text-[var(--ink-2)]">
                      {a.employee?.employeeCode} · masuk {formatJam(a.checkIn)}
                      {a.checkOut && ` · pulang ${formatJam(a.checkOut)}`}
                    </p>
                  </div>
                  <Badge tone={STATUS_ABSENSI[a.status]?.tone ?? "neutral"}>
                    {STATUS_ABSENSI[a.status]?.label ?? a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Ringkasan pribadi untuk karyawan (PRD §10.1). */
async function RingkasanKaryawan({ user }: { user: Awaited<ReturnType<typeof requireUser>> }) {
  const hariIni = todayDate();
  const [absensi, shiftHariIni] = await Promise.all([
    prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: user.employeeId!, date: hariIni } },
    }),
    prisma.employeeShift.findUnique({
      where: { employeeId_date: { employeeId: user.employeeId!, date: hariIni } },
      include: { shift: true },
    }),
  ]);

  const riwayatMinggu = await prisma.attendance.findMany({
    where: { employeeId: user.employeeId!, date: { gte: mulaiMinggu() } },
    orderBy: { date: "desc" },
    take: 7,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-semibold tracking-[-0.02em] text-[var(--ink)]">Halo, {user.fullName}</h1>
        <p className="text-caption text-[var(--ink-2)]">{formatTanggalPanjang(new Date())}</p>
      </header>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-h3 font-semibold">Absensi Hari Ini</h2>
            <div className="flex items-center gap-2">
              <Badge tone={absensi ? (STATUS_ABSENSI[absensi.status]?.tone ?? "neutral") : "neutral"}>
                {absensi ? (STATUS_ABSENSI[absensi.status]?.label ?? absensi.status) : "Belum Absen"}
              </Badge>
              <Link href="/absensi/hari-ini" className="inline-flex items-center gap-1.5 text-caption font-medium text-[var(--brand-ink)]">
                <Clock3 className="size-3.5" aria-hidden /> Absen
              </Link>
            </div>
          </div>

          {absensi ? (
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { l: "Masuk", v: formatJam(absensi.checkIn) },
                { l: "Pulang", v: formatJam(absensi.checkOut) },
                { l: "Durasi", v: formatMenit(absensi.workMinutes ?? 0) },
                { l: "Lembur", v: formatMenit(absensi.overtimeMinutes ?? 0) },
              ].map((x) => (
                <div key={x.l} className="space-y-1">
                  <p className="text-label text-[var(--ink-2)]">{x.l}</p>
                  <p className="font-mono text-time font-medium text-[var(--ink)]">{x.v}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-caption text-[var(--ink-2)]">Anda belum absen hari ini.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-4 text-h3 font-semibold">Shift Hari Ini</h2>
          {shiftHariIni ? (
            <dl className="grid gap-3 sm:grid-cols-4 text-body">
              {[
                { l: "Mulai", v: shiftHariIni.shift.startTime },
                { l: "Selesai", v: shiftHariIni.shift.endTime },
                { l: "Istirahat", v: `${shiftHariIni.shift.breakStart ?? "—"}–${shiftHariIni.shift.breakEnd ?? "—"}` },
                { l: "Toleransi", v: `${shiftHariIni.shift.gracePeriod} mnt` },
              ].map((x) => (
                <div key={x.l}>
                  <dt className="text-label text-[var(--ink-2)]">{x.l}</dt>
                  <dd className="font-mono font-medium text-[var(--ink)]">{x.v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-caption text-[var(--ink-2)]">Tidak ada shift ditugaskan hari ini. Hubungi HR.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4">
            <h2 className="text-h3 font-semibold">Riwayat Minggu Ini</h2>
          </div>
          {riwayatMinggu.length === 0 ? (
            <p className="text-caption text-[var(--ink-2)]">Belum ada data minggu ini.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]/60">
              {riwayatMinggu.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-body font-medium text-[var(--ink)]">{formatTanggal(a.date)}</p>
                    <p className="text-label text-[var(--ink-2)]">
                      Masuk {formatJam(a.checkIn)} · pulang {formatJam(a.checkOut)} · {formatMenit(a.workMinutes ?? 0)}
                    </p>
                  </div>
                  <Badge tone={STATUS_ABSENSI[a.status]?.tone ?? "neutral"}>
                    {STATUS_ABSENSI[a.status]?.label ?? a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function mulaiMinggu(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  // Kolom `attendance.date` adalah @db.Date → batas bawah harus UTC-midnight
  // dari tanggal kalender lokal, bukan midnight waktu-lokal.
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <AppShell user={user} className="mx-auto">
      {STAFF_ROLES.includes(user.role) ? <RingkasanAdmin user={user} /> : <RingkasanKaryawan user={user} />}
    </AppShell>
  );
}
