import type { AttendanceStatus } from "@prisma/client";

/**
 * Engine absensi — fungsi murni tanpa I/O (PRD §6.6–6.7, §25).
 * Semua aturan business rule absensi ada di sini, bukan tersebar di route handler.
 */

export type ShiftDef = {
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  breakStart: string | null;
  breakEnd: string | null;
  gracePeriod: number; // menit
  isOvernight: boolean;
};

export type AbsensiInput = {
  shift: ShiftDef | null;
  checkIn: Date | null;
  checkOut: Date | null;
  overtimeStart?: Date | null;
  overtimeEnd?: Date | null;
  gpsVerified: boolean;
  /** Status dari modul lain (cuti/sakit/libur) — Default null di MVP karena Leave Phase 2. */
  presetStatus?: AttendanceStatus | null;
};

export type AbsensiResult = {
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number;
  overtimeMinutes: number;
};

export type GagalValidasi =
  | { ok: false; code: "WAJIB_CHECK_IN_DULU"; message: string }

  | { ok: false; code: "LOKASI_TIDAK_VALID"; message: string };

/** "09:00" -> menit sejak tengah malam. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Tanggal absensi + "09:00" -> Date waktu lokal server. */
export function atTime(date: Date, hhmm: string): Date {
  const d = new Date(date);
  d.setHours(Math.floor(toMinutes(hhmm) / 60), toMinutes(hhmm) % 60, 0, 0);
  return d;
}

const minutesBetween = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));

/**
 * Hitung status kehadiran.
 * Contoh PRD §6.7: shift 09:00, grace 10 menit → check-in 09:07 = PRESENT,
 * check-in 09:15 = LATE.
 */
export function hitungAbsensi(input: AbsensiInput): AbsensiResult {
  const { shift, checkIn, checkOut, gpsVerified, presetStatus } = input;

  if (presetStatus) {
    return { status: presetStatus, lateMinutes: 0, earlyLeaveMinutes: 0, workMinutes: 0, overtimeMinutes: 0 };
  }

  if (!checkIn) {
    return { status: "INCOMPLETE", lateMinutes: 0, earlyLeaveMinutes: 0, workMinutes: 0, overtimeMinutes: 0 };
  }

  // Aturan §23: GPS wajib dalam radius.
  if (!gpsVerified) {
    return { status: "REJECTED", lateMinutes: 0, earlyLeaveMinutes: 0, workMinutes: 0, overtimeMinutes: 0 };
  }

  // Basis hari untuk batas shift. Sengaja waktu-lokal: `atTime` juga pakai
  // `setHours` lokal, jadi keduanya konsisten dan menghasilkan hari kalender
  // yang sama. Jangan diubah ke UTC — `todayDate()` yang perlu UTC, karena
  // nilainya masuk ke kolom `@db.Date` yang dibandingkan per tanggal UTC.
  const today = new Date(checkIn);
  today.setHours(0, 0, 0, 0);

  if (!shift) {
    // Tanpa shift: hadir, tidak ada hitungan keterlambatan.
    return {
      status: "PRESENT",
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      workMinutes: checkOut ? minutesBetween(checkIn, checkOut) : 0,
      overtimeMinutes: hitungLembur(input),
    };
  }

  const shiftStart = atTime(today, shift.startTime);
  let shiftEnd = atTime(today, shift.endTime);
  if (shift.isOvernight || shiftEnd <= shiftStart) shiftEnd = new Date(shiftEnd.getTime() + 86_400_000);

  const graceEnd = new Date(shiftStart.getTime() + shift.gracePeriod * 60_000);

  // Keterlambatan dihitung terhadap akhir grace period (§6.7).
  const lateMinutes = checkIn.getTime() > graceEnd.getTime()
    ? Math.ceil((checkIn.getTime() - graceEnd.getTime()) / 60_000)
    : 0;

  let workMinutes = 0;
  let earlyLeaveMinutes = 0;
  if (checkOut) {
    workMinutes = minutesBetween(checkIn, checkOut);
    if (checkOut.getTime() < shiftEnd.getTime()) {
      earlyLeaveMinutes = Math.ceil((shiftEnd.getTime() - checkOut.getTime()) / 60_000);
    }
    // Kurangi waktu break dari total kerja.
    if (shift.breakStart && shift.breakEnd) {
      const bs = atTime(today, shift.breakStart);
      const be = atTime(today, shift.breakEnd);
      const overlapStart = Math.max(checkIn.getTime(), bs.getTime());
      const overlapEnd = Math.min(checkOut.getTime(), be.getTime());
      if (overlapEnd > overlapStart) {
        workMinutes = Math.max(0, workMinutes - Math.round((overlapEnd - overlapStart) / 60_000));
      }
    }
  }

  let status: AttendanceStatus = "PRESENT";
  if (!checkOut) status = "INCOMPLETE";
  else if (earlyLeaveMinutes > 0) status = "EARLY_LEAVE";
  else if (lateMinutes > 0) status = "LATE";

  return {
    status,
    lateMinutes,
    earlyLeaveMinutes,
    workMinutes,
    overtimeMinutes: hitungLembur(input),
  };
}

function hitungLembur(input: AbsensiInput): number {
  const { overtimeStart, overtimeEnd, shift, checkOut } = input;
  if (!overtimeStart) return 0;
  const end = overtimeEnd ?? checkOut;
  if (!end) return 0;
  // Lembur hanya dihitung setelah shift berakhir. Waktu-lokal, konsisten
  // dengan `atTime` di atas.
  const today = new Date(input.checkIn ?? overtimeStart);
  today.setHours(0, 0, 0, 0);
  const shiftEnd = shift ? atTime(today, shift.endTime) : new Date(0);
  const from = new Date(Math.max(overtimeStart.getTime(), shiftEnd.getTime()));
  return end > from ? minutesBetween(from, end) : 0;
}

/** Validasi aturan §25 sebelum check-out (§25.2). */
export function validasiCheckOut(sudahCheckIn: boolean): GagalValidasi | null {
  if (!sudahCheckIn) {
    return { ok: false, code: "WAJIB_CHECK_IN_DULU", message: "Anda harus check-in sebelum check-out." };
  }
  return null;
}
