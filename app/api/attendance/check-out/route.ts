import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiPermission, clientIp } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { validateLocation } from "@/lib/lokasi";
import { hitungAbsensi, validasiCheckOut } from "@/lib/absensi/engine";
import { izinkan } from "@/lib/keamanan/rate-limit";
import { audit, catatKeamanan } from "@/lib/audit";
import { headers } from "next/headers";
import { todayDate } from "@/lib/utils";
import { fotoAbsen } from "@/lib/absensi/foto";
import { saveFoto, deleteFoto } from "@/lib/absensi/fotoStorage";
import { AppError, toResponse } from "@/lib/error";

const bodyCheckOut = z.object({
  photo: fotoAbsen,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000),
  takenAt: z.string().datetime(),
  deviceId: z.string().optional(),
});

const JENDELA_FOTO_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  const auth = await requireApiPermission(PERMISSIONS.ATTENDANCE_CHECK_IN);
  if (auth instanceof Response) return auth;

  if (!auth.employeeId) {
    return toResponse(new AppError("Akun Anda belum terhubung ke data karyawan.", "AKUN_TANPA_KARYAWAN", 403));
  }

  const rate = izinkan(`checkout:${auth.id}`, 10, 60_000);
  if (!rate.boleh) {
    await catatKeamanan({
      employeeId: auth.employeeId, userId: auth.id, eventType: "RATE_LIMIT_EXCEEDED",
      severity: "MEDIUM", ipAddress: clientIp(await headers()),
      description: `Rate limit check-out tercapai untuk ${auth.email}`,
    }).catch(() => {});
    return toResponse(new AppError("Terlalu banyak percobaan. Tunggu sebentar.", "RATE_LIMITED", 429));
  }

  let parsed;
  try { parsed = bodyCheckOut.parse(await req.json()); }
  catch (e) {
    const pesan = e instanceof z.ZodError ? e.issues[0]?.message : "Format data tidak valid.";
    return toResponse(new AppError(pesan, "FORMAT_TIDAK_VALID", 400));
  }

  const ip = clientIp(await headers());
  const deviceId = parsed.deviceId ?? null;

  // --- Cegah replay ---
  if (Date.now() - new Date(parsed.takenAt).getTime() > JENDELA_FOTO_MS) {
    return toResponse(new AppError("Sesi absensi sudah kedaluwarsa. Ambil foto lagi.", "FOTO_KEDALUWARSA", 400));
  }

  // --- Aturan §25.2: check-out hanya setelah check-in ---
  const hariIni = todayDate();
  const attendance = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: auth.employeeId, date: hariIni } },
  });

  const invalid = validasiCheckOut(Boolean(attendance?.checkIn));
  if (invalid) {
    return toResponse(new AppError(invalid.message, invalid.code, 409));
  }
  if (attendance!.checkOut) {
    return toResponse(new AppError("Anda sudah check-out hari ini.", "SUDAH_CHECK_OUT", 409));
  }

  // --- Validasi GPS ---
  const kantor = await prisma.office.findFirst({ where: { isActive: true } });
  if (!kantor) {
    return toResponse(new AppError("Kantor belum dikonfigurasi. Hubungi admin.", "KANTOR_BELUM_SET", 500));
  }
  const gps = validateLocation({ latitude: parsed.latitude, longitude: parsed.longitude, accuracy: parsed.accuracy }, kantor);
  if (!gps.ok) {
    await catatKeamanan({
      employeeId: auth.employeeId, userId: auth.id, eventType: "GPS_OUTSIDE_OFFICE", severity: "MEDIUM",
      ipAddress: ip, deviceId: deviceId ?? undefined,
      latitude: parsed.latitude, longitude: parsed.longitude,
      description: `Check-out ditolak: ${gps.reason}`,
    }).catch(() => {});
    return toResponse(new AppError(gps.reason, "GPS_TIDAK_VALID", 422));
  }

  // --- Ambil shift & hitung status final ---
  const assignment = await prisma.employeeShift.findUnique({
    where: { employeeId_date: { employeeId: auth.employeeId, date: hariIni } },
    include: { shift: true },
  });

  const now = new Date();
  const hasil = hitungAbsensi({
    shift: assignment?.shift ? {
      startTime: assignment.shift.startTime, endTime: assignment.shift.endTime,
      breakStart: assignment.shift.breakStart, breakEnd: assignment.shift.breakEnd,
      gracePeriod: assignment.shift.gracePeriod, isOvernight: assignment.shift.isOvernight,
    } : null,
    checkIn: attendance!.checkIn, checkOut: now, gpsVerified: true,
  });

  // Foto check-out disimpan sebagai event (bukan menimpa `attendance.photo`
  // yang berisi foto check-in) — dua bukti berbeda, dua file berbeda.
  const fotoPath = await saveFoto(parsed.photo);

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const att = await tx.attendance.update({
        where: { id: attendance!.id },
        data: {
          checkOut: now, latitude: parsed.latitude, longitude: parsed.longitude,
          accuracy: parsed.accuracy, distanceFromOffice: gps.distance,
          status: hasil.status, lateMinutes: hasil.lateMinutes,
          earlyLeaveMinutes: hasil.earlyLeaveMinutes, workMinutes: hasil.workMinutes,
          overtimeMinutes: hasil.overtimeMinutes,
        },
      });

      await tx.attendanceEvent.create({
        data: {
          attendanceId: att.id, employeeId: auth.employeeId!, eventType: "CHECK_OUT", timestamp: now,
          latitude: parsed.latitude, longitude: parsed.longitude, accuracy: parsed.accuracy,
          deviceId, ipAddress: ip, photo: fotoPath,
          metadata: { distance: gps.distance, workMinutes: hasil.workMinutes, photoTakenAt: parsed.takenAt },
        },
      });

      return att;
    });
  } catch (e) {
    await deleteFoto(fotoPath);
    throw e;
  }

  await audit({ userId: auth.id, action: "UPDATE", entityType: "attendance", entityId: updated.id, oldValue: { checkOut: null, status: attendance!.status }, newValue: { checkOut: now, status: hasil.status, workMinutes: hasil.workMinutes }, ipAddress: ip }).catch(() => {});

  return Response.json({
    ok: true,
    attendance: {
      id: updated.id, checkIn: updated.checkIn, checkOut: updated.checkOut,
      status: hasil.status, lateMinutes: hasil.lateMinutes,
      workMinutes: hasil.workMinutes, overtimeMinutes: hasil.overtimeMinutes,
    },
  });
}
