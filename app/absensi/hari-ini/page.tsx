import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_ABSENSI } from "@/components/ui/badge";
import { KartuAbsen } from "@/components/absensi/kartu-absen";
import { MapPin, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { todayDate, formatJam, formatMenit, formatTanggalPanjang } from "@/lib/utils";

export default async function AbsensiHariIniPage() {
  const user = await requireUser();

  const attendance = await prisma.attendance.findFirst({
    where: { employeeId: user.employeeId!, date: { gte: todayDate() } },
  });

  const shiftToday = await prisma.employeeShift.findUnique({
    where: { employeeId_date: { employeeId: user.employeeId!, date: todayDate() } },
    include: { shift: true },
  });

  const sudahCheckIn = Boolean(attendance?.checkIn);
  const sudahCheckOut = Boolean(attendance?.checkOut);
  const status = attendance?.status ?? "BELUM_ABSEN";

  return (
    <AppShell user={user} maxWidth="max-w-[700px]" className="space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-display font-semibold tracking-[-0.02em] text-[var(--ink)]">Absensi Hari Ini</h1>
          <p className="text-body text-[var(--ink-2)]">{formatTanggalPanjang(new Date())}</p>
        </header>

        {/* Status Card */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption text-[var(--ink-2)]">Status</p>
                <div className="flex items-center gap-2">
                  {STATUS_ABSENSI[status] ? (
                    <Badge tone={STATUS_ABSENSI[status].tone}>{STATUS_ABSENSI[status].label}</Badge>
                  ) : (
                    <Badge tone="neutral">Belum Absen</Badge>
                  )}
                  {sudahCheckIn && !sudahCheckOut && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ok)]/15 px-2.5 py-0.5 text-label font-medium text-[var(--ok-ink)]">
                      <span className="relative inline-block size-2 rounded-full bg-[var(--ok)] animate-pulse" />
                      Sedang Bekerja
                    </span>
                  )}
                </div>
              </div>
            </div>

            {sudahCheckIn && (
              <div className="grid gap-4 sm:grid-cols-4 border-t border-[var(--border)] pt-4">
                <div className="space-y-1">
                  <p className="text-caption text-[var(--ink-2)]">Check-in</p>
                  <p className="text-time font-mono font-medium text-[var(--ink)]">{formatJam(attendance?.checkIn)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[var(--ink-2)]">Check-out</p>
                  <p className="text-time font-mono font-medium text-[var(--ink)]">{formatJam(attendance?.checkOut)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[var(--ink-2)]">Durasi</p>
                  <p className="text-time font-mono font-medium text-[var(--ink)]">{formatMenit(attendance?.workMinutes ?? 0)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[var(--ink-2)]">Lembur</p>
                  <p className="text-time font-mono font-medium text-[var(--ink)]">{formatMenit(attendance?.overtimeMinutes ?? 0)}</p>
                </div>
              </div>
            )}

            {sudahCheckIn && attendance?.distanceFromOffice && (
              <div className="flex items-center gap-2 text-body text-[var(--ink-2)] border-t border-[var(--border)] pt-4">
                <MapPin className="size-4" />
                <span>Jarak dari kantor: {Math.round(attendance.distanceFromOffice)} m</span>
                <Badge tone={attendance.distanceFromOffice <= 150 ? "success" : "warning"}>
                  {attendance.distanceFromOffice <= 150 ? "Dalam Radius" : "Di Luar"}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shift Info */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h3 className="text-h3 font-semibold">Shift Hari Ini</h3>
            {shiftToday ? (
              <div className="grid gap-3 sm:grid-cols-4 text-body">
                <div className="space-y-1">
                  <p className="text-[var(--ink-2)]">Masuk</p>
                  <p className="font-mono font-medium">{shiftToday.shift.startTime}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[var(--ink-2)]">Pulang</p>
                  <p className="font-mono font-medium">{shiftToday.shift.endTime}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[var(--ink-2)]">Istirahat</p>
                  <p className="font-mono font-medium">
                    {shiftToday.shift.breakStart ?? "—"} – {shiftToday.shift.breakEnd ?? "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[var(--ink-2)]">Toleransi</p>
                  <p className="font-mono font-medium">{shiftToday.shift.gracePeriod} menit</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[var(--ink-2)]">
                <AlertTriangle className="size-4 text-amber-500" />
                <span>Tidak ada shift ditugaskan hari ini. Hubungi HR.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aksi */}
        <div className="space-y-4">
          {!sudahCheckIn ? (
            <KartuAbsen mode="check-in" />
          ) : !sudahCheckOut ? (
            <KartuAbsen mode="check-out" />
          ) : (
            <Card>
              <CardContent className="pt-5 text-center">
                <CheckCircle className="size-12 mx-auto mb-2 text-[var(--ok-ink)]" />
                <p className="text-h2 font-semibold text-[var(--ink)]">Absensi Lengkap</p>
                <p className="text-body text-[var(--ink-2)]">Check-in: {formatJam(attendance?.checkIn)} · Check-out: {formatJam(attendance?.checkOut)}</p>
                <div className="mt-4 flex gap-3 justify-center">
                  <Link href="/absensi/riwayat"><Button variant="secondary">Lihat Riwayat</Button></Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Catatan */}
        <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-4 text-body text-[var(--ink-2)] shadow-[var(--shadow-sm)]">
          <ul className="space-y-2 list-disc list-inside">
            <li>Foto di lokasi wajib (PRD §25).</li>
            <li>Check-in setelah toleransi = Terlambat.</li>
            <li>Check-out sebelum jam pulang = Pulang Awal.</li>
            <li>Foto dikirim bersama data absensi; tidak diproses di perangkat.</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
